/**
 * SQLite connection and schema migrations for the study platform.
 *
 * This database is the durable index for everything the app knows: sessions,
 * transcripts, slide metadata, generated artifacts, and chats. It deliberately
 * stays on the local disk forever — media files age out to Google Drive, but
 * the text does not, so browsing, full-text search, reading notes, and chatting
 * all keep working with no network.
 *
 * Intentionally free of `electron` imports at module scope so the whole layer
 * can be unit-tested under plain Node. Callers pass a path; `resolveDbPath()`
 * is the one Electron-aware helper and is imported lazily.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

export type Db = Database.Database;

/** Bumped whenever `MIGRATIONS` gains an entry. */
export const SCHEMA_VERSION = 1;

// ─── Schema ──────────────────────────────────────────────────────────────────

/**
 * Migration 1 — initial study schema.
 *
 * Notes on a few deliberate choices:
 *  - `segments_fts` is an FTS5 *external content* table. It stores no copy of
 *    the text, only the index, and is kept in sync by the three triggers below.
 *    That halves the storage cost of a transcript versus a contentless-copy
 *    setup and keeps `segments` the single source of truth.
 *  - `artifacts` carries a CHECK requiring exactly one owner, so a row can
 *    never be orphaned between a session and a notebook.
 *  - Embeddings are raw Float32 BLOBs. At this corpus size (a semester is on
 *    the order of 30k chunks) brute-force cosine is milliseconds, so there is
 *    no vector-index dependency to carry.
 */
const MIGRATION_1 = `
CREATE TABLE notebooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  course             TEXT,
  source_kind        TEXT NOT NULL CHECK (source_kind IN ('in_person','window','display')),
  started_at         INTEGER NOT NULL,
  ended_at           INTEGER,
  duration_ms        INTEGER,
  video_path         TEXT,
  system_audio_path  TEXT,
  mic_audio_path     TEXT,
  storage_state      TEXT NOT NULL DEFAULT 'local'
                       CHECK (storage_state IN ('local','offloading','remote')),
  drive_ref          TEXT,
  local_bytes        INTEGER NOT NULL DEFAULT 0,
  keep_local         INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_sessions_storage ON sessions(storage_state, started_at);

CREATE TABLE notebook_sessions (
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  PRIMARY KEY (notebook_id, session_id)
);
CREATE INDEX idx_notebook_sessions_session ON notebook_sessions(session_id);

CREATE TABLE segments (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  start_ms    INTEGER NOT NULL,
  end_ms      INTEGER NOT NULL,
  text        TEXT NOT NULL,
  speaker     TEXT NOT NULL CHECK (speaker IN ('system','mic')),
  confidence  REAL
);
CREATE INDEX idx_segments_session ON segments(session_id, start_ms);

CREATE VIRTUAL TABLE segments_fts USING fts5(
  text,
  content='segments',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER segments_ai AFTER INSERT ON segments BEGIN
  INSERT INTO segments_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER segments_ad AFTER DELETE ON segments BEGIN
  INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER segments_au AFTER UPDATE ON segments BEGIN
  INSERT INTO segments_fts(segments_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO segments_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TABLE chunks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  start_ms    INTEGER NOT NULL,
  end_ms      INTEGER NOT NULL,
  text        TEXT NOT NULL,
  embedding   BLOB
);
CREATE INDEX idx_chunks_session ON chunks(session_id, start_ms);

CREATE TABLE frames (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  captured_at_ms  INTEGER NOT NULL,
  path            TEXT NOT NULL,
  phash           TEXT NOT NULL,
  ocr_text        TEXT,
  is_slide        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_frames_session ON frames(session_id, captured_at_ms);

CREATE TABLE artifacts (
  id           TEXT PRIMARY KEY,
  session_id   TEXT REFERENCES sessions(id)  ON DELETE CASCADE,
  notebook_id  TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL
                 CHECK (kind IN ('notes','summary','cards','podcast','video','study_guide')),
  params_json  TEXT NOT NULL DEFAULT '{}',
  markdown     TEXT,
  file_path    TEXT,
  model        TEXT,
  created_at   INTEGER NOT NULL,
  CHECK ((session_id IS NOT NULL) <> (notebook_id IS NOT NULL))
);
CREATE INDEX idx_artifacts_session  ON artifacts(session_id, kind, created_at DESC);
CREATE INDEX idx_artifacts_notebook ON artifacts(notebook_id, kind, created_at DESC);

CREATE TABLE cards (
  id           TEXT PRIMARY KEY,
  artifact_id  TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  front        TEXT NOT NULL,
  back         TEXT NOT NULL,
  tags_json    TEXT NOT NULL DEFAULT '[]',
  source_ms    INTEGER
);
CREATE INDEX idx_cards_artifact ON cards(artifact_id);

CREATE TABLE chats (
  id           TEXT PRIMARY KEY,
  session_id   TEXT REFERENCES sessions(id)  ON DELETE CASCADE,
  notebook_id  TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  CHECK ((session_id IS NOT NULL) <> (notebook_id IS NOT NULL))
);
CREATE INDEX idx_chats_session  ON chats(session_id, created_at DESC);
CREATE INDEX idx_chats_notebook ON chats(notebook_id, created_at DESC);

CREATE TABLE chat_messages (
  id              TEXT PRIMARY KEY,
  chat_id         TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  citations_json  TEXT NOT NULL DEFAULT '[]',
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id, created_at);
`;

/** Indexed by target version: `MIGRATIONS[0]` takes the schema from 0 → 1. */
const MIGRATIONS: string[] = [MIGRATION_1];

// ─── Connection ──────────────────────────────────────────────────────────────

/**
 * Default database location. Lives beside the existing settings.json and
 * license.json rather than in Application Support, matching where this app
 * already keeps its config.
 */
export function resolveDbPath(): string {
  return join(homedir(), '.snapforge', 'study.db');
}

export interface OpenOptions {
  /** Absolute path, or ':memory:' for tests */
  path?: string;
  /** Emit SQL to console — noisy, off by default */
  verbose?: boolean;
}

/**
 * Opens the database, applies pragmas, and migrates to `SCHEMA_VERSION`.
 * Safe to call repeatedly; migrations are idempotent by version check.
 */
export function openDatabase(options: OpenOptions = {}): Db {
  const path = options.path ?? resolveDbPath();

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path, {
    verbose: options.verbose ? console.log : undefined,
  });

  // WAL lets the age-out sweeper read while a recording writes segments.
  // It is a no-op on :memory: databases, which report 'memory' instead.
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  // Give the sweeper room to wait rather than throwing SQLITE_BUSY outright.
  db.pragma('busy_timeout = 5000');

  migrate(db);
  return db;
}

/**
 * Applies any migrations the database has not yet seen.
 *
 * Uses SQLite's built-in `user_version` rather than a bookkeeping table: it is
 * a single integer in the file header, costs nothing to read, and cannot drift
 * out of sync with the schema it describes.
 */
export function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;

  if (current > SCHEMA_VERSION) {
    throw new Error(
      `study.db was created by a newer version of SnapForge ` +
        `(schema v${current}, this build understands v${SCHEMA_VERSION}). ` +
        `Update the app rather than downgrading the database.`
    );
  }

  for (let version = current; version < SCHEMA_VERSION; version++) {
    const sql = MIGRATIONS[version];
    // DDL and the version bump must land together, or a crash mid-migration
    // leaves a half-built schema that claims to be complete.
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version + 1}`);
    })();
    console.log(`[DB] Migrated schema ${version} → ${version + 1}`);
  }
}

// ─── Embedding helpers ───────────────────────────────────────────────────────

/** Float32 vector → BLOB for storage. */
export function encodeEmbedding(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/**
 * BLOB → Float32 vector.
 *
 * Copies rather than viewing the Buffer's memory: better-sqlite3 hands back
 * Buffers backed by pooled allocations whose byteOffset is rarely 4-aligned,
 * and Float32Array requires alignment.
 */
export function decodeEmbedding(blob: Buffer): Float32Array {
  const copy = new ArrayBuffer(blob.byteLength);
  new Uint8Array(copy).set(blob);
  return new Float32Array(copy);
}

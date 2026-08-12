import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  openDatabase,
  migrate,
  SCHEMA_VERSION,
  encodeEmbedding,
  decodeEmbedding,
  type Db,
} from './db';

const tempDirs: string[] = [];

function fileDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'snapforge-db-test-'));
  tempDirs.push(dir);
  return openDatabase({ path: join(dir, 'study.db') });
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

/** Minimal valid session row — most tests only care that one exists. */
function insertSession(db: Db, id = 's1'): string {
  db.prepare(
    `INSERT INTO sessions (id, title, source_kind, started_at, created_at)
     VALUES (?, ?, 'window', 1000, 1000)`
  ).run(id, `Lecture ${id}`);
  return id;
}

function insertSegment(db: Db, sessionId: string, id: string, text: string): void {
  db.prepare(
    `INSERT INTO segments (id, session_id, start_ms, end_ms, text, speaker)
     VALUES (?, ?, 0, 1000, ?, 'system')`
  ).run(id, sessionId, text);
}

describe('migrations', () => {
  it('brings a fresh database to the current schema version', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  });

  it('is idempotent — re-running applies nothing', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(() => migrate(db)).not.toThrow();
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  });

  it('survives reopening an existing database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapforge-db-reopen-'));
    tempDirs.push(dir);
    const path = join(dir, 'study.db');

    const first = openDatabase({ path });
    insertSession(first, 'persisted');
    first.close();

    const second = openDatabase({ path });
    const row = second.prepare('SELECT title FROM sessions WHERE id = ?').get('persisted');
    expect(row).toEqual({ title: 'Lecture persisted' });
    expect(second.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  });

  it('refuses to open a database from a newer build rather than corrupting it', () => {
    const db = openDatabase({ path: ':memory:' });
    db.pragma(`user_version = ${SCHEMA_VERSION + 5}`);
    expect(() => migrate(db)).toThrow(/newer version of SnapForge/);
  });

  it('enables WAL on a file-backed database', () => {
    const db = fileDb();
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  it('enforces foreign keys', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('full-text search', () => {
  it('finds a segment by a word spoken inside it', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    insertSegment(db, s, 'g1', 'the first law of thermodynamics states');
    insertSegment(db, s, 'g2', 'completely unrelated administrivia');

    const hits = db
      .prepare(
        `SELECT s.id FROM segments_fts f
         JOIN segments s ON s.rowid = f.rowid
         WHERE segments_fts MATCH ?`
      )
      .all('thermodynamics') as Array<{ id: string }>;

    expect(hits.map((h) => h.id)).toEqual(['g1']);
  });

  it('stems via the porter tokenizer so "state" matches "states"', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    insertSegment(db, s, 'g1', 'the first law of thermodynamics states');

    const hits = db
      .prepare(`SELECT rowid FROM segments_fts WHERE segments_fts MATCH ?`)
      .all('state');

    expect(hits).toHaveLength(1);
  });

  it('keeps the index in sync when a segment is edited', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    insertSegment(db, s, 'g1', 'entropy always increases');

    db.prepare('UPDATE segments SET text = ? WHERE id = ?').run('enthalpy is different', 'g1');

    const stale = db
      .prepare(`SELECT rowid FROM segments_fts WHERE segments_fts MATCH ?`)
      .all('entropy');
    const fresh = db
      .prepare(`SELECT rowid FROM segments_fts WHERE segments_fts MATCH ?`)
      .all('enthalpy');

    expect(stale).toHaveLength(0);
    expect(fresh).toHaveLength(1);
  });

  it('drops rows from the index when a segment is deleted', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    insertSegment(db, s, 'g1', 'isothermal expansion');

    db.prepare('DELETE FROM segments WHERE id = ?').run('g1');

    const hits = db
      .prepare(`SELECT rowid FROM segments_fts WHERE segments_fts MATCH ?`)
      .all('isothermal');
    expect(hits).toHaveLength(0);
  });
});

describe('referential integrity', () => {
  it('cascades a session delete to its transcript, chunks, and frames', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    insertSegment(db, s, 'g1', 'some speech');
    db.prepare(
      `INSERT INTO chunks (id, session_id, start_ms, end_ms, text) VALUES ('c1', ?, 0, 1, 'x')`
    ).run(s);
    db.prepare(
      `INSERT INTO frames (id, session_id, captured_at_ms, path, phash)
       VALUES ('f1', ?, 0, '/tmp/a.jpg', 'ff00')`
    ).run(s);

    db.prepare('DELETE FROM sessions WHERE id = ?').run(s);

    const count = (t: string): number =>
      (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
    expect(count('segments')).toBe(0);
    expect(count('chunks')).toBe(0);
    expect(count('frames')).toBe(0);
    // The FTS index must not be left holding rows for deleted segments.
    expect(count('segments_fts')).toBe(0);
  });

  it('rejects an artifact that belongs to neither a session nor a notebook', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(() =>
      db
        .prepare(
          `INSERT INTO artifacts (id, kind, created_at) VALUES ('a1', 'notes', 1)`
        )
        .run()
    ).toThrow();
  });

  it('rejects an artifact that claims both a session and a notebook', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    db.prepare(`INSERT INTO notebooks (id, name, created_at) VALUES ('n1','Thermo',1)`).run();

    expect(() =>
      db
        .prepare(
          `INSERT INTO artifacts (id, session_id, notebook_id, kind, created_at)
           VALUES ('a1', ?, 'n1', 'notes', 1)`
        )
        .run(s)
    ).toThrow();
  });

  it('rejects an unknown storage state', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(() =>
      db
        .prepare(
          `INSERT INTO sessions (id, title, source_kind, started_at, created_at, storage_state)
           VALUES ('bad','x','window',1,1,'archived')`
        )
        .run()
    ).toThrow();
  });
});

describe('embeddings', () => {
  it('round-trips a vector through SQLite without drift', () => {
    const db = openDatabase({ path: ':memory:' });
    const s = insertSession(db);
    const vec = new Float32Array([0.125, -0.5, 0.75, 1, -0.0625]);

    db.prepare(
      `INSERT INTO chunks (id, session_id, start_ms, end_ms, text, embedding)
       VALUES ('c1', ?, 0, 1000, 'text', ?)`
    ).run(s, encodeEmbedding(vec));

    const { embedding } = db.prepare('SELECT embedding FROM chunks WHERE id = ?').get('c1') as {
      embedding: Buffer;
    };

    expect(embedding.byteLength).toBe(vec.length * 4);
    expect(Array.from(decodeEmbedding(embedding))).toEqual(Array.from(vec));
  });

  it('decodes correctly from an unaligned buffer', () => {
    // SQLite hands back Buffers sliced out of a pool, so byteOffset is often
    // not a multiple of 4. Viewing that memory directly would throw; decode
    // must copy. Simulate the worst case explicitly.
    const vec = new Float32Array([1.5, 2.5, 3.5]);
    const padded = Buffer.alloc(vec.byteLength + 1);
    Buffer.from(vec.buffer).copy(padded, 1);
    const unaligned = padded.subarray(1);

    expect(unaligned.byteOffset % 4).not.toBe(0);
    expect(Array.from(decodeEmbedding(unaligned))).toEqual([1.5, 2.5, 3.5]);
  });
});

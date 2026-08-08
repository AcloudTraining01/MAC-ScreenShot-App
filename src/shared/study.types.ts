/**
 * Study-platform types shared across main, preload, and renderer processes.
 *
 * Kept separate from types.ts (which covers the screenshot app) because the
 * study subsystem is large enough to warrant its own module — same reasoning
 * as constants.ts and features.ts living apart.
 *
 * Keep this file free of Node.js or browser-only imports.
 */

// ── Notebooks (a course) ─────────────────────────────────────────────────────
export interface Notebook {
  id: string;
  name: string;
  /** Hex colour used for the sidebar dot */
  color: string;
  createdAt: number;
}

// ── Sessions (one recorded lecture) ──────────────────────────────────────────

/**
 * Where the recording came from.
 *  - `in_person` → microphone only, no screen worth capturing
 *  - `window`    → a single app window (Zoom call, Chrome tab playing Udemy)
 *  - `display`   → an entire display
 */
export type SessionSourceKind = 'in_person' | 'window' | 'display';

/**
 * Where the session's media currently lives.
 * Transcript/notes/cards always stay in SQLite, so `remote` sessions remain
 * fully browsable, searchable, and chattable while offline.
 */
export type StorageState = 'local' | 'offloading' | 'remote';

export interface Session {
  id: string;
  title: string;
  /** Free-text course label; notebooks are the structured grouping */
  course?: string;
  sourceKind: SessionSourceKind;
  startedAt: number;
  /** null while a recording is still in progress */
  endedAt?: number;
  durationMs?: number;

  /** Absolute paths — absent when the source kind produced no such track */
  videoPath?: string;
  systemAudioPath?: string;
  micAudioPath?: string;

  storageState: StorageState;
  /** Drive file/folder identifier once offloaded */
  driveRef?: string;
  /** Bytes currently occupied on this machine; 0 once fully offloaded */
  localBytes: number;
  /** User pin — excluded from automatic age-out */
  keepLocal: boolean;
  createdAt: number;
}

// ── Transcript ───────────────────────────────────────────────────────────────

/**
 * Which audio track a segment came from. Because system audio and microphone
 * are recorded to separate files, this gives real speaker attribution with no
 * diarization model: in an online class `system` is the professor and `mic`
 * is the user.
 */
export type SpeakerTrack = 'system' | 'mic';

export interface Segment {
  id: string;
  sessionId: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: SpeakerTrack;
  /** Whisper's average log-prob mapped to 0..1; undefined for other providers */
  confidence?: number;
}

/** A retrieval unit — several segments merged to a useful embedding size. */
export interface Chunk {
  id: string;
  sessionId: string;
  startMs: number;
  endMs: number;
  text: string;
  /** Float32 vector, stored as a BLOB. Absent until the embedder has run. */
  embedding?: Float32Array;
}

// ── Slide frames ─────────────────────────────────────────────────────────────
export interface Frame {
  id: string;
  sessionId: string;
  capturedAtMs: number;
  path: string;
  /** 64-bit dHash as a hex string; used to suppress near-duplicate frames */
  phash: string;
  ocrText?: string;
  /** False for frames kept as motion samples rather than genuine slide changes */
  isSlide: boolean;
}

// ── Artifacts (everything the AI generates) ──────────────────────────────────

/**
 * One generalized table backs every generated output. The user creates these
 * on demand — notes, a podcast, a summary video, a card deck — so keeping one
 * row shape means the Studio UI is a single list rather than six special cases.
 */
export type ArtifactKind =
  | 'notes'
  | 'summary'
  | 'cards'
  | 'podcast'
  | 'video'
  | 'study_guide';

export interface Artifact {
  id: string;
  /** Set for single-lecture artifacts */
  sessionId?: string;
  /** Set for artifacts spanning a whole course */
  notebookId?: string;
  kind: ArtifactKind;
  /** Generator inputs (style name, voice, length target…) for reproducibility */
  params: Record<string, unknown>;
  /** Text output — notes, summaries, study guides. Survives media offload. */
  markdown?: string;
  /** Binary output — podcast.mp3, summary.mp4, notes.pdf */
  filePath?: string;
  /** Model that produced it, for provenance when prompts or models change */
  model?: string;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  artifactId: string;
  front: string;
  back: string;
  tags: string[];
  /** Timestamp in the lecture this card was drawn from — enables jump-to-source */
  sourceMs?: number;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

/**
 * A chat is scoped to exactly one of a session or a notebook. That distinction
 * selects the retrieval strategy: a single lecture is small enough to place
 * entirely in context (and cache), whereas a notebook needs embedding search
 * across its member sessions.
 */
export interface Chat {
  id: string;
  sessionId?: string;
  notebookId?: string;
  title: string;
  createdAt: number;
}

/** A source reference the UI turns into a click-to-seek link. */
export interface Citation {
  sessionId: string;
  /** Denormalized so citations still render if the session is offloaded */
  sessionTitle: string;
  startMs: number;
  /** The quoted span the answer relied on */
  quote?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: number;
}

// ── Note styles ──────────────────────────────────────────────────────────────

/**
 * Styles are data, not code: each is a markdown file under
 * `~/.snapforge/note-styles/`. The body is injected verbatim into the system
 * prompt, so adding a new format is dropping in a file — no rebuild.
 */
export interface NoteStyle {
  /** Filename without extension, used as the stable identifier */
  id: string;
  name: string;
  description?: string;
  /** Full markdown body, including the worked example */
  body: string;
  /** True for the seeded default, which is overwritten on upgrade */
  isBuiltIn: boolean;
}

// ── Recorder ─────────────────────────────────────────────────────────────────

/** A capturable display or window, as enumerated by the Swift helper. */
export interface CaptureTarget {
  kind: 'display' | 'window';
  /** ScreenCaptureKit identifier */
  id: string;
  /** "Zoom — Meeting" or "Built-in Retina Display" */
  title: string;
  /** Owning application, for window targets */
  appName?: string;
  width: number;
  height: number;
}

export type RecordingState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'processing'
  | 'error';

export interface RecordingStatus {
  state: RecordingState;
  sessionId?: string;
  elapsedMs: number;
  /** Slide frames captured so far — the visible sign that detection is working */
  frameCount: number;
  /** Peak levels 0..1 for the HUD meters */
  systemLevel: number;
  micLevel: number;
  error?: string;
}

export interface RecordingOptions {
  target: CaptureTarget | null;
  captureMic: boolean;
  captureSystemAudio: boolean;
  /** Ignored for `in_person` sessions, which record no video */
  videoHeight: 720 | 1080;
  title: string;
  notebookId?: string;
}

// ── Storage accounting ───────────────────────────────────────────────────────
export interface StorageUsage {
  totalBytes: number;
  localBytes: number;
  remoteBytes: number;
  sessionCount: number;
  localSessionCount: number;
  /** Absent when neither Drive backend is available */
  driveBackend?: 'folder' | 'api';
}

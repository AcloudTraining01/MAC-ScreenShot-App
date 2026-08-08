# SnapForge → Study Platform: Lecture Capture, Transcription, AI Notes & Notebook Chat

> **Approved plan, as written before implementation began.** It is kept close to its
> original form on purpose, so the reasoning behind each decision stays legible.
>
> Where implementation has since diverged, the divergence and its cause are recorded in
> `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` — check those for **current status** before
> trusting a detail here. Known divergences so far: the Electron upgrade turned out to be
> blocking rather than optional (`better-sqlite3` needs Node 22+), and `@electron/rebuild`
> proved unnecessary because better-sqlite3 ships N-API prebuilds.

## Context

SnapForge today is a menu-bar screenshot tool: Electron 33 + React 18 + Zustand, capture via the macOS `screencapture` CLI, a Fabric.js annotation editor, local Tesseract OCR, and a flat `library.json` index. There is no audio, no video, no network calls, and no LLM integration anywhere in the codebase.

The target is a local-first study platform. It sits in the menu bar during a lecture — a physical classroom, a Teams/Zoom call, or a Udemy/YouTube course — and records what happens. Afterwards it produces a full transcript, human-style notes, flashcards, a podcast-style audio summary, and a narrated summary video. Every lecture becomes a source you can interrogate: a NotebookLM-style chat over one lecture or a whole course, with every answer citing a timestamp you can click to jump to that moment in the video.

**Decisions locked with the user:**

| Decision | Choice |
|---|---|
| Transcription | Local `whisper.cpp` default, swappable provider |
| "Handwritten notes" | Human-*style* notes (selective, abbreviated, arrows, boxed defs, exam flags) as digital text — **not** a handwriting font |
| Capture scope | Video + system audio + mic + slide frames, any app (Teams, Zoom, Udemy, YouTube, in-person) |
| Code signing | **Apple Developer ID + notarization** |
| Text-to-speech | Kokoro-82M local ONNX |
| Summary video | Real captured slides + AI narration + burned-in captions + Ken Burns motion |
| Video defaults | 1080p H.264, video only for online classes; in-person is audio-only |
| Outputs | In-app library + PDF + Anki + podcast + video + chat |
| Google Drive | Drive-for-Desktop folder if present, OAuth Drive API fallback |
| Offload policy | Whole sessions age out after N days |

**Still owed by the user** (accommodated without code changes): their note-format styles and detail-level examples, as drop-in files under `~/.snapforge/note-styles/*.md`.

---

## Key technical findings

These are load-bearing — each one killed an obvious approach.

**1. Chromium cannot record video + system audio on macOS. Use ScreenCaptureKit instead.**
`electron-audio-loopback` is Electron 31–38 only and audio-only, warning "you may find bugs if you don't remove video tracks." Electron 39+ has native loopback but [regressed](https://github.com/electron/electron/issues/49607) — silent audio tracks in 40.1.0, last known good 35.1.2. There is no reliable simultaneous video+audio path. A bundled **Swift ScreenCaptureKit helper** (macOS 13+) delivers screen video, system audio, microphone, and per-window scoping through one hardware-accelerated Apple API, with no Chromium version-regression exposure. This is what Electron [#47490](https://github.com/electron/electron/issues/47490) asks Electron to adopt.

**2. The helper takes the Electron upgrade off the critical path.** No loopback API, no `getUserMedia`, therefore no hidden capture-host window. Electron 33 can stay for now; upgrading becomes routine maintenance rather than a blocker.

**3. Screen Recording permission is now unavoidable**, and ad-hoc signing is what makes it painful. `identity: null` produces a new signature every build, so macOS silently revokes the grant — that is the actual root cause of the stale-TCC dance in `platform.mac.ts`. Developer ID signing fixes it permanently, and also retires the `xattr -cr` instructions in `INSTALL.md`.

**4. Separate audio tracks give speaker attribution for free.** The helper writes system audio and mic to separate files. For an online class, system = professor, mic = you. Transcribe independently, merge by timestamp — real speaker labels with no diarization model.

**5. `library.json` cannot carry this.** `writeLibraryIndex()` ([index.ts:63](src/main/index.ts#L63)) rewrites the whole file per mutation. Needs SQLite.

**6. Base64 data-URIs over IPC will not survive media.** `saveToLibrary` / `init-preview` / `init-editor` pass whole images as strings. New media paths use file paths plus a `snapforge://` protocol handler.

**7. `tccutil reset ScreenCapture` with no bundle id ([platform.mac.ts:124](src/main/platform/platform.mac.ts#L124)) wipes every app's screen-recording grant on the machine.** Unrelated bug; must go.

---

## Architecture

```
┌─ Recorder HUD ──────────────────────────────────────────────┐
│  ● 00:42:17   ⬤ Zoom — Window   🎤 On   1080p   ▮▮ Stop      │
└──────────────────────────────────────────────────────────────┘
        │ IPC
        ▼
┌─ main process ──────────────────────────────────────────────┐
│  SessionController   spawn/stop helper, powerSaveBlocker     │
│  Pipeline (queue)    transcribe → embed → notes → artifacts  │
│  ArtifactGenerators  notes │ cards │ podcast │ video │ guide │
│  ChatService         single-source stuffing / notebook RAG   │
│  StorageManager      usage accounting → age-out → Drive      │
└──────────────────────────────────────────────────────────────┘
        │ child_process (JSON-lines stdout, stdin control)
        ▼
┌─ SnapForgeRecorder (bundled Swift binary, ScreenCaptureKit) ─┐
│  video.mp4  ·  system.wav (16k)  ·  mic.wav (16k)            │
│  frames/NNNN.jpg  — emitted on dHash change, computed in-proc │
└──────────────────────────────────────────────────────────────┘
```

The helper computes the perceptual hash on pixel buffers it already holds, so slide detection costs nothing extra and needs no second `screencapture` process or post-hoc video decode. It excludes SnapForge's own audio from the system capture (a ScreenCaptureKit feature), so podcast playback can never feed back into a recording.

Whisper consumes the helper's 16 kHz WAVs directly — no ffmpeg transcode on the capture path.

---

## Data model

`~/.snapforge/study.db` (better-sqlite3) — **always local, never offloaded.** It is the search index, the library, and the chat corpus. Keeping it local means browsing, searching, reading notes, and chatting all work offline after media has aged out to Drive.

```sql
notebooks(id, name, color, created_at)                  -- a course
notebook_sessions(notebook_id, session_id)

sessions(id, title, course, source_kind, started_at, ended_at,
         video_path, system_audio_path, mic_audio_path, duration_ms,
         storage_state, drive_ref, local_bytes, created_at)
         -- source_kind: 'in_person' | 'window' | 'display'
         -- storage_state: 'local' | 'offloading' | 'remote'

segments(id, session_id, start_ms, end_ms, text, speaker, confidence)
segments_fts                                            -- FTS5 over text
chunks(id, session_id, start_ms, end_ms, text, embedding BLOB)

frames(id, session_id, captured_at_ms, path, phash, ocr_text, is_slide)

artifacts(id, session_id NULL, notebook_id NULL, kind, params_json,
          markdown, file_path, model, created_at)
          -- kind: 'notes'|'summary'|'cards'|'podcast'|'video'|'study_guide'

cards(id, artifact_id, front, back, tags, source_ms)

chats(id, notebook_id NULL, session_id NULL, title, created_at)
chat_messages(id, chat_id, role, content, citations_json, created_at)
```

`artifacts` is deliberately one generalized table — the user wants to *manually* generate notes, videos, podcasts, and card decks on demand, so every generator produces the same row shape and the UI is one list.

On-disk session payload (this is what ages out):

```
~/Documents/SnapForge/Sessions/2026-08-08--thermo-lec-07/
  video.mp4  system.wav  mic.wav  frames/0001.jpg …
  transcript.md  notes.md  cards.tsv  podcast.mp3  summary.mp4  notes.pdf
```

---

## The Swift helper — `SnapForgeRecorder`

A single-purpose CLI, ~300–400 lines, bundled per-arch in `extraResources`.

| Aspect | Detail |
|---|---|
| Invocation | `SnapForgeRecorder --target window:<id>\|display:<id>\|none --out <dir> --fps 2 --bitrate 1500k --mic on` |
| Capture | `SCStream` + `AVAssetWriter` (hardware H.264) |
| Outputs | `video.mp4`, `system.wav` + `mic.wav` (16 kHz mono PCM), `frames/*.jpg` on slide change |
| Control | JSON-lines on stdout (`{"t":"frame","ms":…}`, `{"t":"error",…}`); stdin `pause`/`resume`/`stop`; SIGTERM finalizes cleanly |
| Enumeration | `--list-targets` returns displays and windows as JSON so the HUD can offer "Zoom — Meeting" or "Chrome — Udemy" |
| Min OS | macOS 13. The dev machine is Darwin 25.3 (macOS 26). |
| Crash safety | `AVAssetWriter` fragmented MP4 so a hard kill still leaves a playable file |

Window-scoped capture is why Teams, Zoom, Udemy, and YouTube are all one code path — you point at a window, not at an integration.

---

## AI pipeline

All Anthropic calls run in the **main process** via `@anthropic-ai/sdk`, so the API key never reaches a renderer. Model `claude-opus-5` with `thinking: { type: 'adaptive' }`, `output_config: { effort: 'high' }`, streamed via `.finalMessage()`. Check `stop_reason === 'refusal'` before reading `content`, and opt into server-side `fallbacks` by default.

| Artifact | Method |
|---|---|
| **Transcript** | whisper-cli on both WAVs → merge by timestamp with speaker labels → segments + FTS + `transcript.md` / `.srt` / `.vtt` export. First-class: viewable, searchable, exportable, and the source every other artifact reads. |
| **Summary** | Short structured overview of the lecture — separate from notes, cheap, generated by default. |
| **Notes** | System prompt = note instructions + the selected style file verbatim (its worked example is the strongest signal for detail level), `cache_control` breakpoint after it. Then slide OCR inventory, then timestamped transcript. Output references slides as `[slide N @ hh:mm:ss]`. |
| **Flashcards** | Second cheaper call over the finished notes, structured outputs (`output_config.format` + `json_schema`) → `{front, back, tags, source_ms}[]`. |
| **Podcast** | Claude writes a two-host conversational script (structured outputs: `{speaker, text}[]`) → Kokoro renders each line with a distinct voice → ffmpeg concat with short crossfades → `podcast.mp3`. |
| **Summary video** | Claude writes a scene script `{slideRef, narration, onScreenText, seconds}[]` → Kokoro narrates → ffmpeg composes captured slide JPEGs with Ken Burns pan/zoom, burned-in captions, and the narration track → `summary.mp4`. Visuals are the professor's real slides, so it needs no video-generation API and costs nothing per render. |
| **Chat** | See below. |

**Vision is selective.** Slide OCR text goes in for every frame; frames with low text density (diagrams, graphs, whiteboard photos) are additionally sent as images. All-vision on a 40-slide deck burns ~60k tokens for negligible gain on text slides.

**Note styles are data, not code.** `~/.snapforge/note-styles/*.md`, seeded with `default-handwritten.md` matching the sample the user approved. Adding one of their formats later is dropping in a file.

### Chat — two modes, deliberately

- **Single lecture:** stuff the entire transcript into context. A 2-hour lecture is ~25k tokens against a 1M window, and a `cache_control` breakpoint makes every follow-up turn a cache read (~$0.02 instead of ~$0.12). No retrieval, no chunking artifacts, perfect recall over that lecture.
- **Notebook / whole course:** embed the query, retrieve top-k chunks across all member sessions, then answer. Embeddings come from a local ONNX model (`bge-small-en-v1.5`) via `onnxruntime-node` — which Kokoro already pulls in, so it costs one shared dependency rather than two. Stored as BLOBs; brute-force cosine over a semester (~30k chunks) runs in tens of milliseconds, so no vector database is needed. `sqlite-vec` is the upgrade path if the corpus ever outgrows that.

Every answer cites `[Lec 7 @ 00:23:41]`, and clicking a citation seeks the video to that moment. That link — chat answer → exact second of real lecture footage — is the feature that makes the corpus worth building.

### Rough cost per 2-hour lecture

| Step | Cost |
|---|---|
| Transcription (local whisper) | $0 |
| Summary + notes (~25k in / 4k out) | ~$0.22 |
| Flashcards | ~$0.04 |
| Podcast script + Kokoro TTS | ~$0.05 + $0 |
| Summary video script + render | ~$0.03 + $0 |
| Chat turn (cached single-lecture) | ~$0.02 |

Roughly **$0.35 to fully process a lecture.** Worth surfacing in Settings.

---

## Storage & Google Drive

1080p H.264 screen content runs ~650 MB/hour. In-person lectures are audio-only (~14 MB/hour), so a mixed schedule is far below worst case — but a 3-course online semester still lands near 60–90 GB. Age-out is essential infrastructure here, not a nicety.

`DriveBackend` interface, two implementations chosen at runtime:

1. **Folder backend (preferred).** Glob `~/Library/CloudStorage/GoogleDrive-*/My Drive`. Offload = move the session directory there; Google syncs and frees local space via its own online-only mode. No OAuth, no GCP project, works day one.
2. **API backend (fallback).** `googleapis` resumable upload, OAuth via a loopback HTTP server on `127.0.0.1` plus `shell.openExternal` to the system browser (Google rejects embedded webviews). Refresh token in `safeStorage`.

> **Prerequisite for the fallback only:** a Google Cloud project with a Desktop-app OAuth client ID, and Google's "unverified app" warning until review. The folder backend has none of that, which is why it ships first.

**Age-out.** `StorageManager` runs at launch and daily; sessions older than `offloadAfterDays` (default 30) move to Drive and flip `storage_state` to `remote`. Transcript, notes, cards, chats, and embeddings stay in SQLite — so search, the library, reading notes, and **chat all keep working offline**. Only video playback, full-size slides, and podcast/video playback rehydrate on demand, with a progress indicator. Settings exposes the threshold, a per-session "keep local" pin, and manual "Offload now".

---

## Files

### New — Swift

| Path | Purpose |
|---|---|
| `native/recorder/Sources/SnapForgeRecorder/main.swift` | CLI entry, arg parsing, JSON-lines protocol |
| `native/recorder/Sources/SnapForgeRecorder/Recorder.swift` | `SCStream` setup, `AVAssetWriter`, audio taps |
| `native/recorder/Sources/SnapForgeRecorder/FrameHasher.swift` | dHash on `CVPixelBuffer`, slide-change emit |
| `native/recorder/Package.swift` | SwiftPM; built per-arch in CI |

### New — main process

| Path | Purpose |
|---|---|
| `src/main/session/sessionController.ts` | Lifecycle, helper process supervision, `powerSaveBlocker`, crash recovery |
| `src/main/session/recorderBridge.ts` | Spawn/stdin/stdout-JSON plumbing to the Swift binary |
| `src/main/pipeline/queue.ts` | Serial post-session job queue, resumable across restarts |
| `src/main/transcription/provider.ts` | `TranscriptionProvider` interface — mirrors the `PlatformAdapter` pattern |
| `src/main/transcription/whisperLocal.ts` | Bundled `whisper-cli`, model download + cache, dual-track merge |
| `src/main/transcription/cloud.ts` | Deepgram/AssemblyAI provider (stub in v1, interface proven) |
| `src/main/ai/client.ts` | Anthropic SDK wrapper: caching, streaming, refusal fallbacks |
| `src/main/ai/styles.ts` | Loads `~/.snapforge/note-styles/*.md`, seeds default |
| `src/main/ai/generators/{notes,cards,summary,podcast,video,studyGuide}.ts` | One module per artifact kind |
| `src/main/ai/chat.ts` | Single-source stuffing vs notebook RAG, citation extraction |
| `src/main/ai/embeddings.ts` | `onnxruntime-node` + bge-small, chunking, cosine search |
| `src/main/tts/kokoro.ts` | Kokoro-82M ONNX, voice selection, WAV out |
| `src/main/media/ffmpeg.ts` | Podcast concat, video composition, Ken Burns, caption burn-in |
| `src/main/storage/db.ts` | better-sqlite3 open, migrations, prepared statements |
| `src/main/storage/storageManager.ts` | Usage accounting, age-out scheduler, rehydrate-on-demand |
| `src/main/storage/drive/{index,driveFolder,driveApi}.ts` | Backend factory + two implementations |
| `src/main/secrets.ts` | `safeStorage`-encrypted key store |
| `src/main/export/{pdf,anki}.ts` | `printToPDF` in a hidden window; Anki-importable TSV |

### New — renderer

| Path | Purpose |
|---|---|
| `src/renderer/src/components/RecorderHUD.tsx` | Always-on-top pill: target picker, timer, levels, stop |
| `src/renderer/src/components/StudioWindow.tsx` | Main workspace: notebooks → sessions → artifacts |
| `src/renderer/src/components/TranscriptView.tsx` | Timestamped transcript, speaker labels, search, seek |
| `src/renderer/src/components/NoteView.tsx` | Notes markdown, slide thumbnails, timestamp jump links |
| `src/renderer/src/components/ChatPanel.tsx` | Chat with clickable citations |
| `src/renderer/src/components/PlayerPane.tsx` | Video/audio player, seek-to-citation target |
| `src/renderer/src/store/{sessionStore,studioStore}.ts` | Zustand stores |

### Modified

- **`src/main/index.ts`** — `snapforge://` protocol handler, new window factories, wire `SessionController` + pipeline into `app.whenReady()` alongside existing `setupIPC()` / `createTray()`.
- **`src/main/tray.ts`** — "Start Lecture" / "Stop" / "Open Studio"; left-click stays screenshot.
- **`src/shared/constants.ts`**, **`src/preload/index.ts`**, **`src/renderer/src/App.tsx`** — the three-place IPC contract, in lockstep. **Move the `declare global` block out of `App.tsx:8-52` into `src/preload/api.d.ts`** so it stops being a three-place edit.
- **`src/shared/types.ts`** — `Session`, `Segment`, `Frame`, `Artifact`, `Notebook`, `Chat`, `Flashcard`, `NoteStyle`; extend `AppSettings` (merge-over-`DEFAULT_SETTINGS` at `settingsManager.ts:37` keeps this backward-compatible).
- **`src/shared/features.ts`** — register `study.*` features so `<FeatureGate>` / `useFeatureGate` gate them with no new gating code.
- **`build/entitlements.mac.plist`** — add `com.apple.security.device.audio-input`; **restore `com.apple.security.device.screen-recording`** (video capture requires it, and with Developer ID signing it no longer goes stale).
- **`electron-builder.config.js`** — `extendInfo` with real `NSMicrophoneUsageDescription` and `NSScreenCaptureUsageDescription`; add Swift helper, whisper-cli, ffmpeg, Kokoro + embedding models to `extraResources`; **`mac.target` arch `universal` → `['arm64','x64']`**; remove `identity: null`, add notarization config.
- **`.github/workflows/build-macos.yml`** — build the Swift helper per-arch; add `CSC_LINK` / `CSC_KEY_PASSWORD` / notarization secrets.
- **`scripts/afterSign.cjs`** — codesign bundled binaries (recorder, whisper, ffmpeg).
- **`src/main/platform/platform.mac.ts:124`** — delete the global `tccutil reset ScreenCapture` fallback; simplify the stale-TCC repair flow now that signing is stable.
- **`INSTALL.md` / `README.md`** — drop the `xattr -cr` workaround.

### Reused as-is

`PlatformAdapter` ([platform.types.ts](src/main/platform/platform.types.ts)) as the extension seam; the Tesseract worker singleton ([services/ocr.ts](src/renderer/src/services/ocr.ts)) against slide frames; `settingsManager.ts` merge-over-defaults; `licensing.ts` tier resolution; `features.ts` gating; existing window/theme/hash-routing conventions.

---

## Dependencies

**Add:** `@anthropic-ai/sdk`, `better-sqlite3`, `onnxruntime-node` (shared by Kokoro + embeddings), `@electron/rebuild` (dev), `googleapis` (Phase 7b only)
**Bundle as `extraResources`, per-arch:** `SnapForgeRecorder` (Swift), `whisper-cli` + `ggml-base.en.bin`, `ffmpeg`, Kokoro-82M ONNX (~330 MB), `bge-small-en-v1.5` ONNX (~130 MB)
**Electron:** 33 → latest stable, recommended but **no longer blocking** thanks to the Swift helper.

> **Bundle size is the real cost here** — models and binaries push the DMG toward ~1 GB. Mitigation: ship only whisper's small model inline and fetch Kokoro + embeddings on first use, with a progress UI. Decide during Phase 0.

Native modules plus per-arch binaries make `--universal` fragile — `lipo` on `.node` files and helper executables is a known source of broken bundles. Hence separate arm64/x64 artifacts.

`node_modules/` is not currently installed — `npm ci` before anything.

---

## Phases

| # | Phase | Deliverable |
|---|---|---|
| 0 | **Foundation** | Developer ID signing + notarization in CI, SQLite + FTS + migrations, `secrets.ts`, `snapforge://` protocol, IPC typing consolidation, entitlements/plist, `tccutil` fix, bundle-size decision |
| 1 | **Recorder** | Swift helper, HUD with target picker, session lifecycle, video + dual audio + slide frames, `powerSaveBlocker`, crash recovery |
| 2 | **Transcript** | whisper provider, dual-track speaker merge, transcript view, FTS search, md/srt/vtt export |
| 3 | **Notes & cards** | Anthropic client, style loader, summary + notes + flashcards, PDF and Anki export |
| 4 | **Studio** | Notebooks, sessions list, artifact list, player with seek, storage badges |
| 5 | **Chat** | Embeddings, single-source stuffing + notebook RAG, citations, click-to-seek |
| 6 | **Media generation** | Kokoro TTS, podcast assembly, narrated summary video |
| 7 | **Storage** | Usage accounting, age-out scheduler, Drive folder backend (7a), OAuth API backend (7b) |

**This is a large build — realistically several months.** Phases 0–3 stand alone as a genuinely useful app: record a lecture, get a transcript, get notes and flashcards. Everything after that compounds on the same corpus. Phase 1 carries the most risk (new language, new Apple framework, new signing pipeline) and should be spiked on a throwaway branch before Phase 2+ stacks on it.

---

## Verification

**Phase 0 — signing holds.** `npm ci && npm run dev`; existing screenshot hotkey, editor, library, settings, tray all still work. `npm run build:mac` produces notarized arm64/x64 artifacts; `spctl -a -vvv` reports `accepted (Notarized Developer ID)`; `codesign -d --entitlements -` shows the audio-input and screen-recording entitlements. Grant Screen Recording, rebuild, relaunch — **the grant must survive**, which is the whole point of this phase.

**Phase 1 — the three real scenarios.**
- *In person:* start audio-only, speak 2 minutes, stop. `mic.wav` is non-zero and plays; `sessions` row has sane `duration_ms`; no video file.
- *Online (Zoom/Teams):* start with target = the meeting window. `video.mp4` plays, `system.wav` contains the other party and **not** room noise, `mic.wav` contains only you.
- *Course platform (Udemy/YouTube):* target = browser window. Advance slides; `frames` gains one row per real slide change and none during static stretches. Play a podcast from the app during recording and confirm it is **absent** from `system.wav` (self-audio exclusion).
- Kill the app mid-recording; the fragmented MP4 still plays and the session recovers.

**Phase 2.** Transcribe a known 5-minute clip; spot-check word error rate and that timestamps line up with the video. On an online recording, confirm speaker labels correctly separate professor from you.

**Phase 3.** Run a real lecture through generation; check output against the user's style example for detail level, that `[slide N @ timestamp]` references resolve to the right frames, and that flashcards validate against the schema. TSV imports into Anki without field-mapping errors; PDF opens with slides embedded.

**Phase 5.** Ask a single-lecture question whose answer is spoken mid-lecture; verify the citation timestamp is correct and clicking it seeks the video to that moment. Then ask a cross-lecture question in a notebook and confirm it retrieves from the right session. Check `usage.cache_read_input_tokens` is non-zero on the second chat turn — if it's zero, caching is silently broken.

**Phase 6.** Generate a podcast and listen end-to-end: two distinguishable voices, no clipping at joins, no truncation. Generate a summary video: audio and slides stay in sync, captions match narration, output plays in QuickTime.

**Phase 7.** With `offloadAfterDays=0`, force an age-out. The session directory is gone locally and present in Drive; the library still lists it; notes, transcript, search, **and chat all still work offline**; clicking Play rehydrates the video.

There are no tests, linter, or formatter in this repo today. Phase 0 should add Vitest covering at least the SQLite layer, chunking/cosine search, the style loader, and the recorder JSON-lines protocol parser — the pieces most likely to break silently.

---

## Risks & open items

| Risk | Mitigation |
|---|---|
| Swift helper is a new language + framework in this codebase | Spike it standalone in Phase 1 before anything depends on it; it has a narrow, well-defined CLI contract |
| Bundle approaching ~1 GB with models | Ship whisper-small inline, fetch Kokoro + embeddings on first use with progress UI — decide in Phase 0 |
| Notarization adds CI complexity and an Apple account dependency | Set it up in Phase 0 while the app is still small, not under release pressure |
| Whisper accuracy on heavy accents or dense jargon | Provider interface is in from Phase 2; a cloud provider can be swapped in per session without touching callers |
| Kokoro may sound flat for a two-host podcast | TTS sits behind an interface; ElevenLabs can be added as an opt-in per generation if the local output disappoints |
| 60–90 GB per semester | Phase 7 is not optional; surface a live storage meter from Phase 4 so it never surprises |

**Open item:** the default note style is written from the sample approved during planning. The user's real style files and detail-level examples should replace it as soon as they provide them — dropping `.md` files into `~/.snapforge/note-styles/` needs no code change, and Phase 3 should be re-validated against their examples rather than the placeholder.

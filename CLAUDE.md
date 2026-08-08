# SnapForge — Project Context for Claude

> **Sibling files:** `GEMINI.md` (Gemini / Antigravity) and `AGENTS.md` (Codex / GPT)
> carry the same information for other tools. **If you change project facts here,
> update all three** — they are peers, not a hierarchy.

---

## What this project is

The repository is named `MAC_ScreenShot_App` and the product is called **SnapForge**.
It shipped as a macOS menu-bar screenshot and annotation utility, and that app still
works and must keep working.

It is now being grown into a **local-first study platform**. The goal: leave it running
during a lecture — a physical classroom, or an online class on Teams, Zoom, Udemy, or
YouTube — and afterwards get a full transcript, human-style notes, flashcards, a
podcast-style audio summary, a narrated summary video, and a searchable corpus you can
chat with, where every answer cites a timestamp you can click to jump to that moment in
the recording.

Think "NotebookLM for your own lectures, running on your Mac."

**Read [`docs/STUDY_PLATFORM_PLAN.md`](docs/STUDY_PLATFORM_PLAN.md) for the full approved
plan** — data model, per-phase deliverables, verification steps, and the reasoning behind
each decision. This file is the operational summary; that one is the specification.

---

## Current status

**Phase 0 (Foundation) is complete** — commit `c422d57` on `feat/study-platform-phase0`.

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ Done | Signing, SQLite, secrets, media protocol, IPC typing, tests |
| 1 | ⬜ Next | Swift ScreenCaptureKit recorder, HUD, session lifecycle |
| 2 | ⬜ | whisper transcription, dual-track speaker merge, transcript UI |
| 3 | ⬜ | Notes + flashcards via Claude, PDF/Anki export |
| 4 | ⬜ | Studio: notebooks, sessions, artifacts, player |
| 5 | ⬜ | Chat with citations (local embeddings + RAG) |
| 6 | ⬜ | Kokoro TTS, podcast, narrated summary video |
| 7 | ⬜ | Storage accounting, Drive age-out |

Phases 0–3 form a genuinely useful standalone app. Phase 1 is the highest-risk work
(new language, new Apple framework) and should be spiked before later phases stack on it.

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Electron **43** (Node 24) |
| UI | React 18 + TypeScript (strict), vanilla CSS |
| Build | electron-vite 5, electron-builder 26 |
| State | Zustand |
| Canvas | Fabric.js 7 |
| OCR | tesseract.js (local WASM) |
| DB | better-sqlite3 13 (N-API prebuilds) |
| LLM | `@anthropic-ai/sdk` — **`claude-opus-5`** |
| Tests | Vitest (52 passing) |

**Node 22+ is mandatory.** better-sqlite3 ships N-API 10 prebuilds and segfaults on
Node 20. This is why Electron was upgraded from 33.

---

## Commands

```bash
npm ci                # install (node_modules is not committed)
npm run dev           # dev with HMR
npm run typecheck     # tsc --noEmit — NOT run by the build, run it yourself
npm test              # vitest
npm run build         # electron-vite bundle
npm run build:mac     # package DMGs to release/
```

**esbuild strips types without checking them**, so `npm run build` succeeds on code that
does not typecheck. Always run `npm run typecheck` before claiming something works.

---

## Landmines

Things that have already cost real debugging time. Read before touching the relevant area.

### `ELECTRON_RUN_AS_NODE` is set in this user's shell
Electron then runs as plain Node: the app exits instantly, prints nothing, and leaves no
crash report. `--version` printing a Node version is the tell. Every npm script already
carries `env -u ELECTRON_RUN_AS_NODE`; any manual `electron` invocation needs it too.

### Do not use Electron/Chromium for system audio capture
It looks like the obvious path. It does not work:
- `electron-audio-loopback` is Electron 31–38 only and **audio-only**.
- Electron 39+ native loopback regressed — silent audio tracks
  ([#49607](https://github.com/electron/electron/issues/49607)).
- There is no reliable **video + system audio** path on macOS through Chromium.

The recorder is a **bundled Swift ScreenCaptureKit helper** invoked via `child_process`.
Do not "simplify" it back to `getDisplayMedia`.

### `afterSign.cjs` — `--deep` is load-bearing in one branch only
When signing is skipped (no certificate), electron-builder leaves *all* nested code
unsigned. Signing only the outer bundle yields `code has no resources but signature
indicates they must be present`, and macOS refuses to launch with no error at all.
`--deep` is correct in the ad-hoc branch and must never be used for Developer ID.
The Developer ID branch deliberately does nothing — re-signing there breaks notarization.

### Never build `--universal`
`lipo` is unreliable with native addons and the bundled Swift/whisper/ffmpeg binaries.
Releases are separate arm64 and x64 artifacts.

### Native modules need `asarUnpack`
Native code cannot be `dlopen`'d from inside an asar. `better-sqlite3` is unpacked in
`electron-builder.config.js`. Any future native dependency needs the same.

### The project path contains a space
`/Users/kingsleyasah/Antigravity Projects/...`. node-gyp warns about this. Quote paths in
scripts.

### `LSMinimumSystemVersion` is 12.0, ScreenCaptureKit needs 13+
Unresolved. Raising it drops existing macOS 12 users of the screenshot app. Current
inclination: leave it and have the recorder show a clear message on macOS 12. **Owner
decision — do not change unilaterally.**

---

## Architecture

```
Recorder HUD (always-on-top pill)
        │ IPC
main process
  SessionController   spawn/stop helper, powerSaveBlocker
  Pipeline (queue)    transcribe → embed → notes → artifacts
  ChatService         single-source stuffing / notebook RAG
  StorageManager      usage accounting → age-out → Drive
        │ child_process (JSON-lines stdout, stdin control)
SnapForgeRecorder (Swift, ScreenCaptureKit)
  video.mp4 · system.wav (16k) · mic.wav (16k) · frames/*.jpg
```

### Load-bearing design decisions

**Two separate audio files give speaker attribution for free.** System audio and mic are
recorded separately, so in an online class system = professor, mic = you. Transcribe each
and merge by timestamp — real speaker labels, no diarization model.

**SQLite text is permanent; media ages out.** Transcripts, notes, cards, chats, and
embeddings live in `~/.snapforge/study.db` forever. Only video/audio/frames move to
Google Drive after N days. This is why search, the library, and chat keep working
offline. **Never make a text artifact depend on a file that can be offloaded.**

**Chat is two modes, deliberately.** A single lecture (~25k tokens) is stuffed whole into
context with a `cache_control` breakpoint — perfect recall, ~$0.02 per follow-up turn.
Retrieval is only for whole-course notebook questions. Do not add RAG to single-lecture
chat; it would make it worse and more expensive.

**Note styles are data, not code.** `~/.snapforge/note-styles/*.md`, injected verbatim
into the system prompt. Adding a format is dropping in a file. The owner will supply
their own styles; the built-in default is a placeholder.

**`artifacts` is one generalized table** for notes, summaries, cards, podcasts, videos,
and study guides — because the user generates these on demand and the UI is one list.

---

## Layout

```
src/
  main/
    index.ts                 app entry, windows, IPC, tray wiring
    secrets.ts               safeStorage credential store (main only)
    settingsManager.ts       ~/.snapforge/settings.json + hotkeys
    licensing.ts             free/pro tier (Supabase stubbed)
    onboarding.ts
    tray.ts                  left-click = capture; right-click = menu
    platform/                PlatformAdapter — the OS seam
      platform.mac.ts        screencapture CLI, TCC repair
    storage/db.ts            SQLite: schema, migrations, FTS5
    media/mediaPath.ts       snapforge:// path resolution (Electron-free)
    media/protocol.ts        protocol registration
  preload/
    api.d.ts                 SnapForgeApi — the IPC contract
    index.ts                 contextBridge, typed against SnapForgeApi
  renderer/src/              React; hash-routed windows
  shared/
    types.ts                 screenshot app types
    study.types.ts           study platform types
    constants.ts             IPC channel names, bundle id
    features.ts              free/pro gating registry
```

**Data locations:** `~/.snapforge/` (study.db, settings.json, license.json, secrets.json),
`~/Pictures/SnapForge/` (screenshots), `~/Documents/SnapForge/Sessions/` (recordings).

---

## Conventions

- **IPC:** add the channel to `shared/constants.ts`, implement in `preload/index.ts`,
  declare in `preload/api.d.ts`. The preload object is annotated `SnapForgeApi`, so drift
  is a compile error rather than a runtime `undefined is not a function`.
- **Electron-free cores.** Pure logic (path resolution, crypto, DB) goes in modules with
  no `electron` import, with a thin Electron binding beside it. That is what makes it
  testable — see `mediaPath.ts` / `protocol.ts` and `secrets.ts`.
- **Comments explain why, not what.** The existing code documents rationale for non-obvious
  decisions. Match that; do not narrate the obvious.
- **Style:** section dividers `// ── Name ───`, header block per file, 2-space indent,
  single quotes, semicolons.
- **Failures degrade.** A study-subsystem failure must never break screenshots. See the
  `try/catch` around `openDatabase()` in `main/index.ts`.

---

## Anthropic API usage

Use `claude-opus-5` with `thinking: { type: 'adaptive' }` and
`output_config: { effort: 'high' }`. Stream via `.finalMessage()` — notes exceed the
non-streaming timeout budget. Check `stop_reason === 'refusal'` before reading `content`.
Use structured outputs (`output_config.format` + `json_schema`) for flashcards and scripts.
Put a `cache_control` breakpoint after the style guide so follow-up turns are cache reads.

**All API calls happen in the main process.** The key never reaches a renderer. The
renderer may ask whether a key exists and may set one; only main may use its value.

---

## Not yet done (do not assume these exist)

- Apple Developer ID certificate — CI is wired for it but needs five repository secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`). Until then builds are ad-hoc and the `xattr -cr` instructions in
  `INSTALL.md` still stand.
- The Swift recorder, whisper, Kokoro, ffmpeg, embeddings, Drive — all Phase 1+.
- Bundle-size decision: models would push the DMG toward ~1 GB. Preference is to fetch
  Kokoro and the embedding model on first use rather than bundle them. **Unresolved.**
- `APP_VERSION` in `shared/constants.ts` is stale (`1.0.5` vs package `2.0.1`) and unused.
  Left alone deliberately.

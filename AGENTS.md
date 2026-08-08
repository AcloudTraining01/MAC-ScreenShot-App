# SnapForge — Project Context for Codex / GPT

> **This is the file Codex reads automatically** (`AGENTS.md` is the convention).
>
> **Sibling files:** `CLAUDE.md` and `GEMINI.md` (Gemini / Antigravity) carry the same
> information for other tools. **If you change project facts here, update all three** —
> they are peers, not a hierarchy.

---

## ⚠️ Read this first

**The application calls the Anthropic Claude API. Do not change that.**

You may be running as GPT or Codex, but the product's AI features are built on
`@anthropic-ai/sdk` with the model `claude-opus-5`. This was an explicit product decision
by the owner, not an accident or a placeholder. Do not port note generation, chat, or
flashcards to the OpenAI API, and do not add an `openai` dependency.

---

## What this project is

The repository is named `MAC_ScreenShot_App` and the product is called **SnapForge**.
It shipped as a macOS menu-bar screenshot and annotation utility, and that app remains a
first-class product that must keep working.

It is now also being grown into a **local-first study platform**. The goal: leave it
running during a lecture — a physical classroom, or an online class on Teams, Zoom, Udemy,
or YouTube — and afterwards get a full transcript, human-style notes, flashcards, a
podcast-style audio summary, a narrated summary video, and a searchable corpus you can
chat with, where every answer cites a timestamp you can click to jump to that moment in
the recording.

Think "NotebookLM for your own lectures, running on your Mac."

---

## Two plans, both active

There are **two** planning documents in this repo. Neither supersedes the other.

| Document | Scope | Status |
|---|---|---|
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | The original product plan: cross-platform screenshot utility, freemium tiers, Supabase auth, Stripe billing, Windows port | **Still active.** Phases 1–2 largely built, 3–5 partly or not at all |
| [`docs/STUDY_PLATFORM_PLAN.md`](docs/STUDY_PLATFORM_PLAN.md) | The study platform: lecture recording, transcription, AI notes, podcast/video generation, notebook chat | **Additive.** Phase 0 complete |

**The study platform is an addition, not a replacement.** The screenshot app remains a
first-class product and must keep working. When the two plans touch, the original plan's
architecture wins — study features slot into its existing seams rather than working around
them.

### Where the two plans meet

- **Feature gating.** Study features register in the same `src/shared/features.ts`
  registry the original plan defined, and are gated by the same `<FeatureGate>` /
  `useFeatureGate` machinery. Do not build a parallel entitlement system.
- **Licensing.** The original plan's Phase 5 (Supabase + Stripe) will eventually validate
  Pro access for study features too. `src/main/licensing.ts` is the stub it plugs into.
- **Platform seam.** Both plans route OS-specific behaviour through `PlatformAdapter`
  (`src/main/platform/`). Anything OS-specific goes there.
- **⚠️ Cross-platform tension.** The original plan is explicitly macOS **+ Windows**
  (`platform.win.ts` exists as a stub). The study recorder is **ScreenCaptureKit, which is
  macOS-only.** The study platform must therefore be feature-gated by OS, degrade cleanly
  on Windows, and never block the Windows port of the screenshot app. This is unresolved
  and needs an owner decision before Windows work starts.

---

## Original plan — status audit

Audited against the code, not against the document. `IMPLEMENTATION_PLAN.md` describes
intent; this is what actually exists.

### Phase 1 — Core capture
| Feature | Status |
|---|---|
| Global hotkey, region select, clipboard, save to file | ✅ Built |
| Quick action toolbar (`PreviewWindow`), menu bar icon | ✅ Built |
| Full-screen / window capture | ⚠️ Declared in `features.ts`, not implemented |
| System notifications, repeat last capture | ❌ Not built |

### Phase 2 — Annotation
✅ **Complete.** All 11 tools exist in `src/renderer/src/components/tools/`: Arrow, Rect,
Pen, Text, Blur, Highlight, Step, Crop, Eyedropper, Emoji.

### Phase 3 — Smart features
| Feature | Status |
|---|---|
| OCR (tesseract.js) | ✅ Built |
| Beautifier | ✅ Built |
| "AI Smart Redact" | ⚠️ Built, but it is **regex PII matching**, not AI (`services/piiDetector.ts`) |
| QR scanner, screen ruler, pixel zoom, similar-image search | ❌ Declared in `features.ts`, not implemented |

### Phase 4 — Library, sharing, polish
| Feature | Status |
|---|---|
| Library, hotkeys, theme, onboarding, start-on-login | ✅ Built |
| Full-text search | ⚠️ Partial — `filteredEntries()` matches filename/ocrText only |
| AI tags, share links, WebP/PDF/SVG export, scrolling capture, GIF recording | ❌ Not built |
| Auto-update | ⚠️ CI publishes `latest-mac.yml`, but **`electron-updater` is not a dependency**, so nothing consumes it |

### Phase 5 — Monetization
| Feature | Status |
|---|---|
| Feature-gating UI, daily usage tracking, offline license cache | ✅ Built locally |
| Supabase auth, Stripe checkout, webhooks, customer portal | ❌ **Not started.** No `supabase`, `stripe`, or `electron-updater` reference exists anywhere in `src/` or `package.json` |
| License activation | ⚠️ Stub — any key starting with `PRO-` grants a lifetime licence (`licensing.ts`) |

### Known drift between plan and code
- Capture hotkey is `CmdOrCtrl+Shift+4`, not the planned `Cmd+Shift+2`. Note this
  **overrides the macOS system screenshot shortcut** — the plan's Open Question #4 flagged
  exactly this risk and it was never resolved.
- Offline grace period is **14 days** in `licensing.ts`; the plan specifies 7.
- The plan's Open Questions (app name, pricing, Supabase project, trial, open-source
  strategy) are still unanswered.
- Verification plan calls for Vitest, React Testing Library, and Playwright. Vitest now
  exists (added in study Phase 0); the other two do not.

---

## Study platform — status

**Phase 0 (Foundation) is complete** — commit `c422d57`.

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ Done | Signing, SQLite, secrets, media protocol, IPC typing, tests |
| 1 | ⬜ Next | Swift ScreenCaptureKit recorder, HUD, session lifecycle |
| 2 | ⬜ | whisper transcription, dual-track speaker merge, transcript UI |
| 3 | ⬜ | Notes + flashcards via Claude, PDF/Anki export |
| 4 | ⬜ | Studio: notebooks, sessions, artifacts, player |
| 5 | ⬜ | Chat with citations (local embeddings + RAG) |
| 6 | ⬜ | Kokoro TTS, podcast, narrated summary video |
| 7 | ⬜ | Storage accounting, Google Drive age-out |

Phases 0–3 form a genuinely useful standalone app. Phase 1 is the highest-risk work
(new language, new Apple framework) and should be spiked before later phases stack on it.

### What Phase 0 actually added

- **Electron 33 → 43.** Blocking, not optional: `better-sqlite3@13` needs Node ≥22
  (N-API 10) and Electron 33 shipped Node 20, so the prebuild segfaulted on load. Brought
  electron-builder 26 and electron-vite 5; dropped known vulnerabilities 29 → 5.
- **`~/.snapforge/study.db`** — 10 tables, FTS5 over transcripts via triggers, WAL,
  `user_version` migrations. `src/main/storage/db.ts`.
- **`src/main/secrets.ts`** — safeStorage-encrypted credential store that refuses to fall
  back to plaintext.
- **`snapforge://` protocol** — streams media with Range support instead of base64 IPC.
  Path resolution is Electron-free and hardened against traversal.
- **`src/preload/api.d.ts`** — the IPC contract, with the preload typed against it.
- **Vitest** — 52 tests.
- **Packaging** — universal → arm64 + x64, `asarUnpack` for the native module, Developer ID
  auto-discovery, notarization wired in CI.
- **Two bug fixes** — `tccutil` no longer globally revokes screen recording for every app
  on the machine; removed a dangling `ScreenPermissionStatus` re-export that never compiled.

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
| LLM | `@anthropic-ai/sdk` — `claude-opus-5` |
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
      platform.win.ts        stub — Windows port not started
    storage/db.ts            SQLite: schema, migrations, FTS5
    media/mediaPath.ts       snapforge:// path resolution (Electron-free)
    media/protocol.ts        protocol registration
  preload/
    api.d.ts                 SnapForgeApi — the IPC contract
    index.ts                 contextBridge, typed against SnapForgeApi
  renderer/src/
    components/              windows, panels, 11 annotation tools
    services/                ocr.ts (tesseract), piiDetector.ts (regex)
    store/                   5 Zustand stores
  shared/
    types.ts                 screenshot app types
    study.types.ts           study platform types
    constants.ts             IPC channel names, bundle id, FREE_LIMITS
    features.ts              free/pro gating registry (29 features)
```

**Data locations:** `~/.snapforge/` (study.db, settings.json, license.json, secrets.json),
`~/Pictures/SnapForge/` (screenshots), `~/Documents/SnapForge/Sessions/` (recordings).

---

## Conventions

- **IPC:** add the channel to `shared/constants.ts`, implement in `preload/index.ts`,
  declare in `preload/api.d.ts`. The preload object is annotated `SnapForgeApi`, so drift
  is a compile error rather than a runtime `undefined is not a function`.
- **Feature gating:** every gated capability gets an entry in `shared/features.ts` and is
  wrapped in `<FeatureGate>` / checked via `useFeatureGate`. This applies to study features
  too — no parallel entitlement system.
- **Electron-free cores.** Pure logic (path resolution, crypto, DB) goes in modules with
  no `electron` import, with a thin Electron binding beside it. That is what makes it
  testable — see `mediaPath.ts` / `protocol.ts` and `secrets.ts`.
- **Platform-specific code goes in `PlatformAdapter`**, never inline in feature code.
- **Comments explain why, not what.** The existing code documents rationale for non-obvious
  decisions. Match that; do not narrate the obvious.
- **Style:** section dividers `// ── Name ───`, header block per file, 2-space indent,
  single quotes, semicolons.
- **Failures degrade.** A study-subsystem failure must never break screenshots. See the
  `try/catch` around `openDatabase()` in `main/index.ts`.

---

## Anthropic API usage (for the app's own features)

Use `claude-opus-5` with `thinking: { type: 'adaptive' }` and
`output_config: { effort: 'high' }`. Stream via `.finalMessage()` — notes exceed the
non-streaming timeout budget. Check `stop_reason === 'refusal'` before reading `content`.
Use structured outputs (`output_config.format` + `json_schema`) for flashcards and scripts.
Put a `cache_control` breakpoint after the style guide so follow-up turns are cache reads.

**All API calls happen in the main process.** The key never reaches a renderer. The
renderer may ask whether a key exists and may set one; only main may use its value.

---

## Not yet done (do not assume these exist)

From the **original plan**:
- Supabase auth, Stripe checkout/portal/webhooks — Phase 5 entirely unstarted
- `electron-updater` — CI publishes update metadata that nothing consumes
- Windows port — `platform.win.ts` is a stub; `captureInteractive()` returns null
- QR scanner, screen ruler, pixel zoom, similar-image search, AI tags, share links,
  advanced export formats, scrolling capture, GIF recording
- React Testing Library and Playwright (the plan's component and E2E test layers)

From the **study plan**:
- Everything in Phases 1–7: the Swift recorder, whisper, Kokoro, ffmpeg, embeddings, Drive
- Apple Developer ID certificate — CI is wired for it but needs five repository secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`). Until then builds are ad-hoc and the `xattr -cr` instructions in
  `INSTALL.md` still stand.

**Open decisions needing the owner:**
- Bundle size: models would push the DMG toward ~1 GB. Preference is fetch-on-first-use.
- `LSMinimumSystemVersion` 12.0 vs ScreenCaptureKit's 13+.
- How the macOS-only study platform coexists with the planned Windows port.
- All seven Open Questions in `IMPLEMENTATION_PLAN.md` (name, pricing, trial, Supabase
  project, hotkey conflicts, open-source strategy).

**Minor:** `APP_VERSION` in `shared/constants.ts` is stale (`1.0.5` vs package `2.0.1`) and
unused. Left alone deliberately.

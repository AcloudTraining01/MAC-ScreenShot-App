# SnapForge 📸

**Premium, cross-platform screenshot & annotation utility for macOS**

[![GitHub release](https://img.shields.io/github/v/release/AcloudTraining01/MAC-ScreenShot-App?style=flat-square)](https://github.com/AcloudTraining01/MAC-ScreenShot-App/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?style=flat-square&logo=apple)](https://github.com/AcloudTraining01/MAC-ScreenShot-App/releases/latest)

---

## ✨ Features

- **Instant Capture** — Use `⌘ Shift 4` or click the menu bar icon to capture any region of your screen
- **Annotation Editor** — Draw, add text, arrows, shapes, and highlights on your screenshots
- **OCR Text Extraction** — Extract text from screenshots with built-in Tesseract.js
- **Smart Redaction** — AI-powered PII detection and redaction tools
- **Screenshot Library** — Searchable local library of all your captures
- **Day / Night Theme** — Automatically matches your macOS system appearance
- **Auto Start** — Optionally launches at login so it's always ready
- **Menu Bar App** — Lives quietly in your menu bar, always one click away
- **Native Apple Silicon & Intel** — Separate optimised builds for each architecture

---

## 📥 Download & Install

### Quick Install

1. Download the `.dmg` for your Mac from the [Releases page](https://github.com/AcloudTraining01/MAC-ScreenShot-App/releases/latest):
   - **Apple Silicon** (M1–M4) → `SnapForge-x.x.x-arm64.dmg`
   - **Intel** → `SnapForge-x.x.x-x64.dmg`

   Not sure which you have?  → Apple menu → About This Mac.
2. Open the DMG and drag **SnapForge** into your **Applications** folder
3. Launch SnapForge from Applications

> **Note:** On first launch, macOS may show a security warning. Right-click the app → **Open** → click **Open** to bypass it. This is only needed once.

### If you see "SnapForge is damaged"

Run this in Terminal:

```bash
xattr -cr /Applications/SnapForge.app
```

Then launch again normally.

---

## 🚀 Usage

| Action | Shortcut |
|---|---|
| Capture screenshot | `⌘ Shift 4` or click menu bar icon |
| Open library | `⌘ Shift L` |
| Preferences | Right-click menu bar icon → Preferences |
| Quit | Right-click menu bar icon → Quit |

---

## 🛠 Development

### Prerequisites

- **Node.js 22+** — required; the `better-sqlite3` native addon ships N-API 10
  prebuilds and will not load on Node 20
- npm
- Xcode Command Line Tools (macOS builds)

### Setup

```bash
git clone https://github.com/AcloudTraining01/MAC-ScreenShot-App.git
cd MAC-ScreenShot-App
npm install
```

### Run in Development

```bash
npm run dev
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

### Build for macOS

```bash
npm run build:mac
```

DMGs are output to the `release/` directory, one per architecture.

> **Note:** if you have `ELECTRON_RUN_AS_NODE` set in your shell, Electron will
> run as plain Node and the app will exit immediately with no output. The npm
> scripts unset it; prefix manual `electron` invocations with
> `env -u ELECTRON_RUN_AS_NODE`.

---

## 🏗 Tech Stack

- **Electron** + **electron-vite** — Desktop runtime
- **React 18** + **TypeScript** — UI framework
- **Fabric.js** — Canvas-based annotation editor
- **Zustand** — Lightweight state management
- **Tesseract.js** — OCR engine
- **better-sqlite3** — Local database for the study platform
- **Vitest** — Unit tests
- **electron-builder** — Packaging & distribution

---

## 🎓 Study Platform (in development)

SnapForge is growing into a local-first study app: record a lecture — in a
classroom or an online class on Teams, Zoom, or Udemy — and get a transcript,
human-style notes, flashcards, a podcast summary, and a searchable corpus you
can chat with.

Contributors and AI coding agents should start with **[CLAUDE.md](CLAUDE.md)**
(or the equivalent [GEMINI.md](GEMINI.md) / [AGENTS.md](AGENTS.md)) for
architecture, current status, and the phase plan.

---

## 📄 License

MIT © [kingsleyasah](https://github.com/AcloudTraining01)

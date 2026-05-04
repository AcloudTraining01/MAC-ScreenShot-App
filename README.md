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
- **Universal Binary** — Runs natively on both Apple Silicon (M1–M4) and Intel Macs

---

## 📥 Download & Install

### Quick Install

1. Download the latest **`.dmg`** from the [Releases page](https://github.com/AcloudTraining01/MAC-ScreenShot-App/releases/latest)
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

- Node.js 20+
- npm

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

### Build for macOS

```bash
npm run build:mac
```

The DMG will be output to the `release/` directory.

---

## 🏗 Tech Stack

- **Electron** + **electron-vite** — Desktop runtime
- **React 18** + **TypeScript** — UI framework
- **Fabric.js** — Canvas-based annotation editor
- **Zustand** — Lightweight state management
- **Tesseract.js** — OCR engine
- **electron-builder** — Packaging & distribution

---

## 📄 License

MIT © [kingsleyasah](https://github.com/AcloudTraining01)

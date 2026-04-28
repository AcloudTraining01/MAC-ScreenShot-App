# SnapForge — macOS Install Guide (Beta)

## Download

There is **one DMG for all Macs** — it works natively on both Apple Silicon and Intel.

| File | Works on |
|---|---|
| `SnapForge-x.x.x-universal.dmg` | ✅ Apple Silicon (M1/M2/M3/M4) + ✅ Intel |

> Download from: https://github.com/AcloudTraining01/MAC-ScreenShot-App/releases/latest

---

## Installation

1. Open the `.dmg` file you downloaded
2. Drag **SnapForge** into your **Applications** folder
3. Eject the DMG

---

## ⚠️ First Launch — Gatekeeper Warning

Because SnapForge is in **beta** and not yet registered with Apple, macOS will warn you on first launch:

> *"SnapForge" is an app downloaded from the Internet. Are you sure you want to open it?*

**To open it (one-time only):**
1. Open **Finder** → **Applications**
2. Find **SnapForge**
3. **Right-click** (or Control-click) → **Open**
4. Click **Open** in the dialog

After doing this once, SnapForge opens normally forever.

---

## 🛠 If you see "SnapForge is damaged and can't be opened"

Run this in Terminal:

```bash
xattr -cr /Applications/SnapForge.app
```

Then try launching again.

---

## Using SnapForge

- SnapForge lives in your **menu bar** (top-right, look for the 📸 icon)
- **Capture screenshot:** `⌘ Shift 4` (or click the tray icon)
- **Open library:** `⌘ Shift L`
- **Settings:** Right-click the tray icon → Preferences…
- **Quit:** Right-click the tray icon → Quit

---

## Feedback

Found a bug or have a suggestion? Please open an issue:  
👉 https://github.com/AcloudTraining01/MAC-ScreenShot-App/issues

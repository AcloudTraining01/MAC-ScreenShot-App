# SnapForge — macOS Install Guide (Beta)

## Download

| Mac | Download |
|---|---|
| Apple Silicon (M1/M2/M3/M4) | `SnapForge-x.x.x-arm64.dmg` |
| Intel Mac | `SnapForge-x.x.x.dmg` |

Not sure which you have? → Apple menu → **About This Mac**.  
If it says "Apple M1/M2/M3/M4" → download **arm64**.  
If it says "Intel Core i5/i7/i9" → download the plain `.dmg`.

---

## Installation

1. Open the `.dmg` file you downloaded
2. Drag **SnapForge** into your **Applications** folder
3. Eject the DMG

---

## ⚠️ First Launch — Gatekeeper Warning

Because SnapForge is currently in **beta** and not yet registered with Apple, macOS will show a warning on first launch.

### What you'll see

> *"SnapForge" is an app downloaded from the Internet. Are you sure you want to open it?*

**To open it:**
1. Open **Finder** → **Applications**
2. Find **SnapForge**
3. **Right-click** (or Control-click) → **Open**
4. Click **Open** in the dialog

After doing this once, SnapForge opens normally forever.

---

## 🛠 If you see "SnapForge is damaged and can't be opened"

This happens on some macOS versions when the quarantine flag is applied to the download. Fix it with one Terminal command:

1. Open **Terminal** (Spotlight → type "Terminal" → press Enter)
2. Paste this command and press Enter:

```
xattr -cr /Applications/SnapForge.app
```

3. Try launching SnapForge again — it will open normally.

> If you haven't moved SnapForge to Applications yet, run this instead:
> ```
> xattr -cr ~/Downloads/SnapForge-*.dmg
> ```
> Then re-open the DMG and drag to Applications.

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

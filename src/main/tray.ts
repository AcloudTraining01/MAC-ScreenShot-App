import { Tray, Menu, nativeImage, app, dialog } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

let tray: Tray | null = null;

/**
 * Creates the tray icon as a macOS template image.
 *
 * Template images must be:
 *  - White/black pixels only on a transparent background.
 *  - Paired: `iconTemplate.png` (22×22) + `iconTemplate@2x.png` (44×44).
 *  - Named with the word "Template" in the filename (Electron convention).
 *
 * macOS will automatically adapt the icon color to match the menu bar
 * (white in dark mode, black in light mode) when `setTemplateImage(true)`.
 */
function createTrayIcon(): Electron.NativeImage {
  const resourcesPath = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../../resources');

  const icon1xPath = join(resourcesPath, 'trayIconTemplate.png');
  const icon2xPath = join(resourcesPath, 'trayIconTemplate@2x.png');

  console.log('[Tray] Resources path:', resourcesPath);
  console.log('[Tray] 1x icon path:', icon1xPath, '| exists:', existsSync(icon1xPath));
  console.log('[Tray] 2x icon path:', icon2xPath, '| exists:', existsSync(icon2xPath));

  // Prefer the @2x image (44×44) — Electron/macOS automatically uses it on
  // Retina displays and scales it to 22pt. This gives the sharpest result.
  const iconPath = existsSync(icon2xPath) ? icon2xPath : icon1xPath;

  if (!existsSync(iconPath)) {
    console.warn('[Tray] No icon file found at', iconPath);
    // Return an empty image as last resort so Tray() doesn't throw.
    return nativeImage.createEmpty();
  }

  const img = nativeImage.createFromPath(iconPath);

  if (img.isEmpty()) {
    console.warn('[Tray] nativeImage loaded empty from', iconPath);
    return nativeImage.createEmpty();
  }

  // Resize to 22×22 pt (the @2x file is 44px wide but represents 22pt)
  const resized = img.resize({ width: 22, height: 22 });

  // Mark as template so macOS auto-adapts the color to light/dark menu bar
  resized.setTemplateImage(true);

  console.log('[Tray] Icon loaded successfully — size:', img.getSize());
  return resized;
}

export function createTray(
  onCapture: () => void,
  onOpenLibrary?: () => void,
  onOpenSettings?: () => void
): Tray {
  const icon = createTrayIcon();
  tray = new Tray(icon);

  // Build context menu (shown on right-click only)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📸  Capture Screenshot',
      accelerator: 'CmdOrCtrl+Shift+4',
      click: () => {
        onCapture();
      }
    },
    {
      label: '📂  Screenshot Library',
      accelerator: 'CmdOrCtrl+Shift+L',
      click: () => {
        onOpenLibrary?.();
      }
    },
    {
      label: '⚙️  Preferences…',
      click: () => {
        onOpenSettings?.();
      }
    },
    { type: 'separator' },
    {
      label: 'About SnapForge',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'About SnapForge',
          message: 'SnapForge v1.0.5',
          detail:
            'Premium screenshot utility for macOS.\n\nShortcut: ⌘+Shift+4\nOr click the menu bar icon.\n\n© 2026 kingsleyasah',
          buttons: ['OK']
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Quit SnapForge',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('SnapForge — Click to capture');

  // ── Key macOS behavior ──────────────────────────────────────────────────
  // Left-click → trigger capture immediately.
  // Right-click → show context menu.
  //
  // DO NOT call tray.setContextMenu() — that hijacks left-click on macOS.

  tray.on('click', () => {
    console.log('[Tray] Left-click → starting capture');
    onCapture();
  });

  tray.on('right-click', () => {
    console.log('[Tray] Right-click → showing menu');
    tray?.popUpContextMenu(contextMenu);
  });

  console.log('[Tray] Tray created successfully');
  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

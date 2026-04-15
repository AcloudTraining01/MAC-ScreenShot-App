import { Tray, Menu, nativeImage, app, dialog } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'trayIconTemplate.png')
    : join(__dirname, '../../resources/trayIconTemplate.png');

  console.log('[Tray] Icon path:', iconPath);
  console.log('[Tray] File exists:', existsSync(iconPath));

  const img = nativeImage.createFromPath(iconPath);

  if (!img.isEmpty()) {
    const resized = img.resize({ width: 22, height: 22 });
    resized.setTemplateImage(true);
    return resized;
  }

  // Fallback: create a minimal empty image so Tray doesn't crash
  console.warn('[Tray] Icon image empty, using fallback.');
  return nativeImage.createEmpty();
}

export function createTray(onCapture: () => void, onOpenLibrary?: () => void): Tray {
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
    { type: 'separator' },
    {
      label: 'About SnapForge',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'About SnapForge',
          message: 'SnapForge v1.0.0',
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

  // ── Key macOS behavior fix ──
  // On macOS, `setContextMenu` makes left-click ALSO open the menu.
  // Instead, we handle left-click manually to trigger capture,
  // and only show the context menu on right-click.
  //
  // DO NOT call tray.setContextMenu() — that hijacks left-click.

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

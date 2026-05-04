/**
 * macOS Platform Adapter
 *
 * Implements all macOS-specific behaviour:
 *  - Native `screencapture -i -x` for interactive region capture
 *  - Login items via app.setLoginItemSettings()
 *  - Dock icon hidden (lives in menu bar)
 *
 * Screen recording permission is handled entirely by macOS: the app bundle
 * declares the com.apple.security.device.screen-recording entitlement, so
 * on first use macOS will prompt the user via its standard system dialog.
 * No custom permission UI or TCC manipulation is needed.
 */
import { app } from 'electron';
import { exec } from 'child_process';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, statSync } from 'fs';
import type { PlatformAdapter } from './platform.types';

export class MacPlatformAdapter implements PlatformAdapter {
  readonly name = 'macOS';

  // ── Modifier key ───────────────────────────────────────────────────────────
  getAcceleratorPrefix(): 'CmdOrCtrl' {
    return 'CmdOrCtrl';
  }

  getModifierSymbol(): string {
    return '⌘';
  }

  // ── Default paths ──────────────────────────────────────────────────────────
  getDefaultSavePath(): string {
    return join(homedir(), 'Desktop', 'SnapForge');
  }

  getLibraryPath(): string {
    return join(homedir(), 'Pictures', 'SnapForge');
  }

  // ── Auto-start ─────────────────────────────────────────────────────────────
  registerAutoStart(enabled: boolean): void {
    if (!app.isPackaged) {
      console.log('[Platform/mac] registerAutoStart skipped — dev mode');
      return;
    }
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,   // Don't show a window at login — just the tray icon
        path: app.getPath('exe'),
      });
      console.log(`[Platform/mac] openAtLogin → ${enabled}`);
    } catch (err) {
      console.error('[Platform/mac] setLoginItemSettings failed:', err);
    }
  }

  // ── GPU / rendering ────────────────────────────────────────────────────────
  configureGPU(): void {
    // macOS generally has no GPU capture issues.
    // No-op for now; add workarounds here if blank screenshots appear.
  }

  // ── Dock icon ──────────────────────────────────────────────────────────────
  hideDockIcon(): void {
    app.dock?.hide();
  }

  // ── Capture engine ─────────────────────────────────────────────────────────
  captureInteractive(): Promise<string | null> {
    return new Promise((resolve) => {
      const tmpPath = join(tmpdir(), `snapforge-${Date.now()}.png`);

      // -i  interactive selection (crosshair)
      // -x  suppress sound
      exec(`screencapture -i -x "${tmpPath}"`, (err) => {
        if (err) {
          // Non-zero exit: permission denied or user pressed Esc before selecting
          console.error('[Platform/mac] screencapture error:', err);
          resolve(null);
          return;
        }

        if (!existsSync(tmpPath)) {
          // User pressed Escape — no file written
          resolve(null);
          return;
        }

        try {
          const fileInfo = statSync(tmpPath);
          if (fileInfo.size === 0) {
            unlinkSync(tmpPath);
            resolve(null);
            return;
          }

          const buf = readFileSync(tmpPath);
          const dataUri = 'data:image/png;base64,' + buf.toString('base64');
          unlinkSync(tmpPath);
          resolve(dataUri);
        } catch (e) {
          console.error('[Platform/mac] Failed to read capture file:', e);
          resolve(null);
        }
      });
    });
  }
}

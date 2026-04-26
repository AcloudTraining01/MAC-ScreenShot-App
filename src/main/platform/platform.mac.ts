/**
 * macOS Platform Adapter
 *
 * Implements all macOS-specific behaviour:
 *  - Screen Recording permission via systemPreferences
 *  - Native `screencapture -i -x` for interactive region capture
 *  - Login items via app.setLoginItemSettings()
 *  - Dock icon hidden (lives in menu bar)
 */
import { app, systemPreferences, shell } from 'electron';
import { exec } from 'child_process';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import type { PlatformAdapter, ScreenPermissionStatus } from './platform.types';

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

  // ── Screen-capture permission ──────────────────────────────────────────────
  checkScreenCapturePermission(): ScreenPermissionStatus {
    // systemPreferences.getMediaAccessStatus is macOS 10.15+
    return systemPreferences.getMediaAccessStatus('screen') as ScreenPermissionStatus;
  }

  async requestScreenCapturePermission(): Promise<void> {
    const status = this.checkScreenCapturePermission();
    if (status === 'granted') return;

    // macOS doesn't expose a programmatic prompt for screen recording —
    // we must guide the user to System Settings manually.
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    );
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
          console.error('[Platform/mac] screencapture error:', err);
          resolve(null);
          return;
        }

        if (!existsSync(tmpPath)) {
          // User pressed Escape — no file written
          console.log('[Platform/mac] Capture cancelled by user.');
          resolve(null);
          return;
        }

        try {
          const buf = readFileSync(tmpPath);
          const dataUri = 'data:image/png;base64,' + buf.toString('base64');
          unlinkSync(tmpPath); // clean up temp file
          resolve(dataUri);
        } catch (e) {
          console.error('[Platform/mac] Failed to read capture file:', e);
          resolve(null);
        }
      });
    });
  }
}

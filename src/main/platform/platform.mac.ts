/**
 * macOS Platform Adapter
 *
 * Implements all macOS-specific behaviour:
 *  - Screen Recording permission via systemPreferences
 *  - Native `screencapture -i -x` for interactive region capture
 *  - Login items via app.setLoginItemSettings()
 *  - Dock icon hidden (lives in menu bar)
 *  - TCC permission recovery when ad-hoc signature changes between builds
 */
import { app, systemPreferences, shell, dialog } from 'electron';
import { exec, execSync } from 'child_process';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, statSync } from 'fs';
import type { PlatformAdapter, ScreenPermissionStatus } from './platform.types';

/** Tracks whether we've already shown the TCC reset dialog this session */
let hasShownPermissionRecovery = false;

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

  // ── TCC permission recovery ────────────────────────────────────────────────
  /**
   * When an ad-hoc signed app is rebuilt, the code-signature hash changes.
   * macOS TCC database still has the old entry showing "granted", but the
   * runtime denies the new binary. This method:
   *  1. Resets the TCC entry for our bundle ID
   *  2. Shows a dialog explaining what happened
   *  3. Opens System Settings so the user can re-grant permission
   */
  private async handleStalePermission(): Promise<void> {
    if (hasShownPermissionRecovery) return;
    hasShownPermissionRecovery = true;

    console.warn('[Platform/mac] Detected stale TCC permission — resetting...');

    // Reset our screen recording TCC entry so the old stale grant is removed
    try {
      execSync('tccutil reset ScreenCapture com.snapforge.app');
      console.log('[Platform/mac] TCC entry reset successfully.');
    } catch (resetErr) {
      // tccutil may fail on older macOS versions — not critical
      console.warn('[Platform/mac] tccutil reset failed (non-fatal):', resetErr);
    }

    // Show a user-friendly dialog explaining the situation
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Screen Recording Permission Needed',
      message: 'SnapForge needs to refresh its screen recording permission.',
      detail:
        'This happens after an app update because macOS links permissions to the app\'s signature, which changes with each build.\n\n' +
        'Click "Open Settings" to grant permission again. After enabling it, you may need to restart SnapForge.',
      buttons: ['Open Settings', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
    }
  }

  // ── Capture engine ─────────────────────────────────────────────────────────
  captureInteractive(): Promise<string | null> {
    return new Promise((resolve) => {
      const tmpPath = join(tmpdir(), `snapforge-${Date.now()}.png`);

      // -i  interactive selection (crosshair)
      // -x  suppress sound
      exec(`screencapture -i -x "${tmpPath}"`, async (err) => {
        if (err) {
          console.error('[Platform/mac] screencapture error:', err);

          // Check if this is a permission-denied scenario:
          // The API says "granted" but the binary hash doesn't match the TCC entry
          const apiStatus = this.checkScreenCapturePermission();
          if (apiStatus === 'granted') {
            console.warn('[Platform/mac] API says granted but screencapture failed — stale TCC entry detected.');
            await this.handleStalePermission();
          }
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
          // Check for zero-byte file — another symptom of denied permission
          const fileInfo = statSync(tmpPath);
          if (fileInfo.size === 0) {
            console.warn('[Platform/mac] screencapture produced empty file — possible permission issue.');
            unlinkSync(tmpPath);

            const apiStatus = this.checkScreenCapturePermission();
            if (apiStatus === 'granted') {
              await this.handleStalePermission();
            }
            resolve(null);
            return;
          }

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

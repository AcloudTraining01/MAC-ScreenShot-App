/**
 * macOS Platform Adapter
 *
 * Implements all macOS-specific behaviour:
 *  - Native `screencapture -i -x` for interactive region capture
 *  - Login items via app.setLoginItemSettings()
 *  - Dock icon hidden (lives in menu bar)
 *  - Automatic stale TCC permission detection & reset
 *
 * The TCC stale-permission problem:
 *   macOS ties screen-recording grants to the app's code-signing identity.
 *   Ad-hoc builds (identity: null) produce a different hash on every build,
 *   so the old TCC entry becomes "stale" — the toggle shows ON in System
 *   Settings, but macOS still denies access because the signature no longer
 *   matches.  We detect this on launch and reset the entry automatically.
 */
import { app, dialog, shell, systemPreferences } from 'electron';
import { exec, execSync } from 'child_process';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, statSync, writeFileSync } from 'fs';
import type { PlatformAdapter } from './platform.types';

export class MacPlatformAdapter implements PlatformAdapter {
  readonly name = 'macOS';

  // Track whether we've already shown the permission fix dialog this session
  private _permFixShown = false;

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

  // ── Permission check ──────────────────────────────────────────────────────
  /**
   * Checks whether the app *actually* has screen-recording access by
   * performing a quick 1×1 pixel test capture.  systemPreferences.getMediaAccessStatus
   * can return "granted" from a stale TCC entry, so this functional test is
   * the only reliable check.
   */
  private async _hasWorkingScreenPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      const testPath = join(tmpdir(), `snapforge-permtest-${Date.now()}.png`);

      // Capture a 1×1 pixel rectangle at 0,0 — almost instant, no user interaction
      exec(`screencapture -x -R0,0,1,1 "${testPath}"`, { timeout: 5000 }, (err) => {
        if (err) {
          resolve(false);
          return;
        }

        if (!existsSync(testPath)) {
          resolve(false);
          return;
        }

        try {
          const info = statSync(testPath);
          unlinkSync(testPath);
          // A valid 1×1 PNG is > 0 bytes; permission-denied produces 0 bytes or error
          resolve(info.size > 0);
        } catch {
          resolve(false);
        }
      });
    });
  }

  /**
   * Reset SnapForge's stale TCC entry so macOS will prompt cleanly on next use.
   * Uses `tccutil` which is the Apple-sanctioned way to reset entries.
   */
  private _resetTCCEntry(): void {
    try {
      execSync('tccutil reset ScreenCapture com.snapforge.app', { timeout: 5000 });
      console.log('[Platform/mac] TCC ScreenCapture entry reset for com.snapforge.app');
    } catch (err) {
      console.error('[Platform/mac] tccutil reset failed:', err);
      // Fallback: try resetting all screen capture entries
      try {
        execSync('tccutil reset ScreenCapture', { timeout: 5000 });
        console.log('[Platform/mac] TCC ScreenCapture reset (all apps)');
      } catch (err2) {
        console.error('[Platform/mac] tccutil reset (all) failed:', err2);
      }
    }
  }

  /**
   * Called early in app startup. Detects stale TCC and shows a user-friendly
   * dialog explaining how to fix it.
   */
  async checkAndFixPermissions(): Promise<void> {
    // Quick functional test — does screencapture actually work?
    const hasPermission = await this._hasWorkingScreenPermission();

    if (hasPermission) {
      console.log('[Platform/mac] ✓ Screen recording permission is working.');
      return;
    }

    console.warn('[Platform/mac] ✗ Screen recording permission test FAILED.');

    // Check what macOS *thinks* the status is
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log(`[Platform/mac] systemPreferences reports: "${status}"`);

    if (status === 'granted') {
      // Classic stale TCC — toggle is ON but signature doesn't match
      console.log('[Platform/mac] Stale TCC detected — resetting entry...');
      this._resetTCCEntry();
    }

    if (this._permFixShown) return;
    this._permFixShown = true;

    // Show a user-friendly dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Screen Recording Permission Required',
      message: 'SnapForge needs screen recording access to capture screenshots.',
      detail:
        'Please follow these steps:\n\n' +
        '1. Click "Open System Settings" below\n' +
        '2. Find "SnapForge" in the list\n' +
        '3. Toggle it OFF, then back ON\n' +
        '4. If prompted, click "Quit & Reopen"\n\n' +
        'This is a one-time fix needed because macOS links permissions to the app signature.',
      buttons: ['Open System Settings', 'Later'],
      defaultId: 0,
    });

    if (result.response === 0) {
      // Open the exact Privacy & Security → Screen Recording pane
      shell.openExternal(
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
      exec(`screencapture -i -x "${tmpPath}"`, (err) => {
        if (err) {
          // Non-zero exit: permission denied or user pressed Esc before selecting
          console.error('[Platform/mac] screencapture error:', err);

          // Check if this is a permission issue and offer to fix
          this._handleCapturePermissionError();
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
            // Zero-byte file = permission denied silently
            this._handleCapturePermissionError();
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

  /**
   * When a capture fails due to permissions, reset the stale TCC entry
   * and show a helpful dialog (once per session).
   */
  private async _handleCapturePermissionError(): Promise<void> {
    const status = systemPreferences.getMediaAccessStatus('screen');

    if (status === 'granted') {
      // Stale entry — reset it so the next attempt triggers a clean prompt
      console.log('[Platform/mac] Capture failed but TCC says granted — resetting stale entry');
      this._resetTCCEntry();
    }

    if (this._permFixShown) return;
    this._permFixShown = true;

    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Screen Recording Permission',
      message: 'SnapForge cannot capture your screen.',
      detail:
        'macOS requires you to grant screen recording permission.\n\n' +
        '1. Click "Fix Now" to open System Settings\n' +
        '2. Find "SnapForge" in the list\n' +
        '3. Toggle it OFF, then back ON\n' +
        '4. Try capturing again\n\n' +
        'If SnapForge isn\'t in the list, try capturing once more — macOS will add it automatically.',
      buttons: ['Fix Now', 'Cancel'],
      defaultId: 0,
    });

    if (result.response === 0) {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
    }
  }
}

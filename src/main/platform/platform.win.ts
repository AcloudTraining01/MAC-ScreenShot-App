/**
 * Windows Platform Adapter
 *
 * Implements all Windows-specific behaviour:
 *  - No screen-recording permission required (always 'granted')
 *  - Optional GPU flags for machines that produce blank screenshots
 *  - Login items via app.setLoginItemSettings() (cross-platform API)
 *  - No dock icon (Windows has a taskbar tray instead)
 *
 * NOTE: captureInteractive() on Windows will use Electron's desktopCapturer
 * API with a custom overlay. This is a Phase 1 Windows-port task — for now
 * it returns null with a clear console message.
 */
import { app } from 'electron';
import { homedir } from 'os';
import { join } from 'path';
import type { PlatformAdapter, ScreenPermissionStatus } from './platform.types';

export class WinPlatformAdapter implements PlatformAdapter {
  readonly name = 'Windows';

  // ── Modifier key ───────────────────────────────────────────────────────────
  getAcceleratorPrefix(): 'CmdOrCtrl' {
    return 'CmdOrCtrl'; // Electron resolves this to Ctrl on Windows automatically
  }

  getModifierSymbol(): string {
    return 'Ctrl';
  }

  // ── Default paths ──────────────────────────────────────────────────────────
  getDefaultSavePath(): string {
    // %USERPROFILE%\Desktop\SnapForge
    return join(homedir(), 'Desktop', 'SnapForge');
  }

  getLibraryPath(): string {
    // %USERPROFILE%\Pictures\SnapForge
    return join(homedir(), 'Pictures', 'SnapForge');
  }

  // ── Screen-capture permission ──────────────────────────────────────────────
  checkScreenCapturePermission(): ScreenPermissionStatus {
    // Windows doesn't require special permissions for screen capture
    return 'granted';
  }

  async requestScreenCapturePermission(): Promise<void> {
    // No-op on Windows — permission is always available
  }

  // ── Auto-start ─────────────────────────────────────────────────────────────
  registerAutoStart(enabled: boolean): void {
    if (!app.isPackaged) {
      console.log('[Platform/win] registerAutoStart skipped — dev mode');
      return;
    }
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
        path: app.getPath('exe'),
      });
      console.log(`[Platform/win] openAtLogin → ${enabled}`);
    } catch (err) {
      console.error('[Platform/win] setLoginItemSettings failed:', err);
    }
  }

  // ── GPU / rendering ────────────────────────────────────────────────────────
  configureGPU(): void {
    // Some Windows machines (especially with older Intel integrated graphics)
    // produce blank screenshots when D3D11 is active. Uncomment if needed:
    // app.commandLine.appendSwitch('disable-gpu-sandbox');
    // app.commandLine.appendSwitch('disable-d3d11');
    console.log('[Platform/win] GPU configuration applied (no flags set by default).');
  }

  // ── Dock icon ──────────────────────────────────────────────────────────────
  hideDockIcon(): void {
    // Windows has no dock. The tray icon (taskbar notification area)
    // is already the primary UI surface — no action needed.
  }

  // ── Capture engine ─────────────────────────────────────────────────────────
  async captureInteractive(): Promise<string | null> {
    // TODO (Phase 1 Windows port): Implement using Electron desktopCapturer
    // with a transparent fullscreen overlay window for region selection.
    //
    // The pattern:
    //   1. desktopCapturer.getSources({ types: ['screen'] }) → full-screen PNG
    //   2. Open a transparent BrowserWindow with drag-to-select UI
    //   3. Crop the captured PNG to the selected rectangle
    //   4. Return data URI
    console.warn('[Platform/win] captureInteractive() not yet implemented for Windows.');
    return null;
  }
}

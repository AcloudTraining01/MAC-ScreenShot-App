/**
 * Platform Adapter Interface — the contract every platform must fulfil.
 *
 * All platform-specific behaviour in SnapForge is routed through this
 * interface so the rest of the codebase stays 100% cross-platform.
 */

export interface PlatformAdapter {
  /** Human-readable platform name e.g. 'macOS', 'Windows' */
  readonly name: string;

  // ── Modifier key ──────────────────────────────────────────────────────────
  /** The Electron accelerator prefix for the primary modifier key */
  getAcceleratorPrefix(): 'CmdOrCtrl';

  /** Symbol shown in UI e.g. '⌘' (macOS) or 'Ctrl' (Windows) */
  getModifierSymbol(): string;

  // ── Default paths ─────────────────────────────────────────────────────────
  /** Absolute path for the default screenshot save directory */
  getDefaultSavePath(): string;

  /** Absolute path for the library image directory */
  getLibraryPath(): string;

  // ── Auto-start ────────────────────────────────────────────────────────────
  /** Configure whether the app launches at user login */
  registerAutoStart(enabled: boolean): void;

  // ── GPU / rendering workarounds ───────────────────────────────────────────
  /**
   * Apply any platform-specific GPU / rendering flags before app.whenReady().
   * On macOS this is a no-op. On Windows it may disable D3D11.
   */
  configureGPU(): void;

  // ── Dock / taskbar ────────────────────────────────────────────────────────
  /**
   * Hide the app from the dock / taskbar so it lives only in the tray/menu-bar.
   * Called once during app initialisation.
   */
  hideDockIcon(): void;

  // ── Capture engine ────────────────────────────────────────────────────────
  /**
   * Perform an interactive screen capture and return the result as a PNG
   * data URI, or null if the user cancelled.
   *
   * macOS  → native `screencapture -i -x`
   * Windows → Electron desktopCapturer + custom overlay (Phase 1 port task)
   */
  captureInteractive(): Promise<string | null>;

  // ── Permission helpers ──────────────────────────────────────────────────
  /**
   * Check and fix platform-specific capture permissions on startup.
   * On macOS this detects stale TCC entries and resets them.
   * Optional — not all platforms need this.
   */
  checkAndFixPermissions?(): Promise<void>;
}

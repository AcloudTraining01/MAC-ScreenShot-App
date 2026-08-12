/**
 * The contract between main and renderer — the single source of truth for
 * everything reachable as `window.api`.
 *
 * Previously this interface lived inline in `App.tsx`, which meant adding an
 * IPC channel required editing three files that nothing forced to agree:
 * `shared/constants.ts`, `preload/index.ts`, and the renderer's declaration.
 * A typo in any one of them produced a runtime `undefined is not a function`
 * rather than a compile error.
 *
 * Now `preload/index.ts` annotates its exposed object as `SnapForgeApi`, so a
 * method declared here but not implemented — or implemented with the wrong
 * signature — fails `npm run typecheck`. The renderer picks the shape up via
 * the global augmentation at the bottom of this file.
 */
import type {
  AppSettings,
  LibraryEntry,
  LicenseValidationResult,
} from '../shared/types';

/** Removes the listener. Returned by every `on*` subscription. */
export type Unsubscribe = () => void;

export interface SnapForgeApi {
  // ── Preview ────────────────────────────────────────────────────────────────
  onInitPreview: (callback: (uri: string) => void) => Unsubscribe;
  copyScreenshot: (uri: string) => void;
  downloadScreenshot: (uri: string) => void;
  closePreview: () => void;

  // ── Editor ─────────────────────────────────────────────────────────────────
  openEditor: (uri: string) => void;
  onInitEditor: (callback: (uri: string) => void) => Unsubscribe;
  copyEdited: (uri: string) => void;
  saveEdited: (uri: string) => void;
  closeEditor: () => void;

  // ── Library ────────────────────────────────────────────────────────────────
  openLibrary: () => void;
  getLibrary: () => Promise<LibraryEntry[]>;
  deleteScreenshot: (id: string) => void;
  openInEditor: (filePath: string) => void;
  openInFinder: (filePath: string) => void;
  closeLibrary: () => void;
  onLibraryUpdated: (callback: () => void) => Unsubscribe;
  updateOcrText: (id: string, ocrText: string) => void;

  // ── Theme ──────────────────────────────────────────────────────────────────
  getSystemTheme: () => Promise<'dark' | 'light'>;
  onThemeChanged: (callback: (theme: string) => void) => Unsubscribe;

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => Unsubscribe;
  openSettings: () => void;
  closeSettings: () => void;
  pickDirectory: () => Promise<string | null>;

  // ── Onboarding ─────────────────────────────────────────────────────────────
  completeOnboarding: () => void;
  skipOnboarding: () => void;

  // ── Licensing ──────────────────────────────────────────────────────────────
  getTier: () => Promise<LicenseValidationResult>;
  activateLicense: (key: string) => Promise<LicenseValidationResult>;
  deactivateLicense: () => void;
  onLicenseChanged: (callback: (result: LicenseValidationResult) => void) => Unsubscribe;
}

declare global {
  interface Window {
    api: SnapForgeApi;
  }
}

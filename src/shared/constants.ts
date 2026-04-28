/**
 * App-wide constants shared across main, preload, and renderer.
 */

export const APP_NAME = 'SnapForge';
export const APP_VERSION = '1.0.4';

/** IPC channel names — single source of truth to avoid typos */
export const IPC = {
  // ── Capture / Preview ──
  INIT_PREVIEW: 'init-preview',
  COPY_SCREENSHOT: 'copy-screenshot',
  DOWNLOAD_SCREENSHOT: 'download-screenshot',
  CLOSE_PREVIEW: 'close-preview',

  // ── Editor ──
  OPEN_EDITOR: 'open-editor',
  INIT_EDITOR: 'init-editor',
  COPY_EDITED: 'copy-edited',
  SAVE_EDITED: 'save-edited',
  CLOSE_EDITOR: 'close-editor',

  // ── Library ──
  OPEN_LIBRARY: 'open-library',
  GET_LIBRARY: 'get-library',
  DELETE_SCREENSHOT: 'delete-screenshot',
  OPEN_IN_EDITOR: 'open-in-editor',
  OPEN_IN_FINDER: 'open-in-finder',
  CLOSE_LIBRARY: 'close-library',
  LIBRARY_UPDATED: 'library-updated',
  UPDATE_OCR_TEXT: 'update-ocr-text',

  // ── Theme ──
  GET_SYSTEM_THEME: 'get-system-theme',
  THEME_CHANGED: 'theme-changed',

  // ── Settings ──
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SETTINGS_CHANGED: 'settings-changed',
  REREGISTER_HOTKEYS: 'reregister-hotkeys',

  // ── Licensing ──
  GET_TIER: 'get-tier',
  ACTIVATE_LICENSE: 'activate-license',
  DEACTIVATE_LICENSE: 'deactivate-license',
  LICENSE_CHANGED: 'license-changed',
} as const;

/** Library storage */
export const LIBRARY_SUBDIR = 'SnapForge';   // under ~/Pictures/
export const CONFIG_SUBDIR  = '.snapforge';  // under ~/
export const LIBRARY_INDEX_FILE = 'library.json';
export const SETTINGS_FILE      = 'settings.json';

/** Daily usage limits for free tier */
export const FREE_LIMITS = {
  ocr: 5,
  blur: 3,
  beautifier: 3,
  cloudShare: 5,
} as const;

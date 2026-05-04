/**
 * Settings Manager — main-process module that persists AppSettings
 * to ~/.snapforge/settings.json and owns the hotkey re-registration
 * whenever settings change.
 */
import { ipcMain, globalShortcut, app } from 'electron';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { AppSettings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { IPC } from '../shared/constants';

const CONFIG_DIR = join(homedir(), '.snapforge');
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json');

/** Ensure the config directory exists */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

/** Load settings from disk, merging with defaults for any missing keys */
export function loadSettings(): AppSettings {
  ensureConfigDir();
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('[Settings] Failed to read settings file:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

/** Persist settings to disk */
export function saveSettings(settings: AppSettings): void {
  ensureConfigDir();
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[Settings] Saved to disk.');
  } catch (err) {
    console.error('[Settings] Failed to write settings file:', err);
  }
}

/**
 * Register (or re-register) global hotkeys using the current settings.
 * Unregisters all previous shortcuts first to avoid duplicates.
 *
 * @param onCapture   Callback for the capture hotkey
 * @param onLibrary   Callback for the library hotkey
 * @param settings    Current AppSettings
 */
export function registerHotkeys(
  onCapture: () => void,
  onLibrary: () => void,
  settings: AppSettings
): void {
  globalShortcut.unregisterAll();

  const registerOne = (accelerator: string, label: string, handler: () => void): void => {
    if (!accelerator) return;
    const ok = globalShortcut.register(accelerator, handler);
    if (!ok) {
      console.warn(`[Hotkeys] Failed to register ${label} (${accelerator})`);
    } else {
      console.log(`[Hotkeys] Registered ${label} → ${accelerator}`);
    }
  };

  registerOne(settings.captureHotkey, 'Capture', onCapture);
  registerOne(settings.libraryHotkey, 'Library', onLibrary);
}

/**
 * Wire up IPC handlers for settings.
 * Call once during app initialisation after settings are loaded.
 */
export function setupSettingsIPC(
  getSettings: () => AppSettings,
  onCapture: () => void,
  onLibrary: () => void
): void {
  // Renderer asks for current settings
  ipcMain.handle(IPC.GET_SETTINGS, () => {
    return getSettings();
  });

  // Renderer saves updated settings
  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, updatedSettings: AppSettings) => {
    saveSettings(updatedSettings);
    // Re-register hotkeys if they changed
    registerHotkeys(onCapture, onLibrary, updatedSettings);
    // Return the saved settings so renderer can confirm
    return updatedSettings;
  });

  // Auto-launch is gated by Pro in the UI, but we apply it here
  ipcMain.handle(IPC.REREGISTER_HOTKEYS, (_event, settings: AppSettings) => {
    registerHotkeys(onCapture, onLibrary, settings);

    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: settings.launchOnLogin,
        openAsHidden: true,
        path: app.getPath('exe'),
      });
    }
  });
}

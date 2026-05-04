/**
 * Settings Store — holds app settings synced with the main process
 * via IPC, and persisted to ~/.snapforge/settings.json on disk.
 */
import { create } from 'zustand';
import type { AppSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/types';

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;

  // Actions
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  /** Load settings from main process */
  load: () => Promise<void>;
  /** Persist current settings to main process */
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoaded: false,

  setSettings: (settings) => set({ settings, isLoaded: true }),

  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),

  load: async () => {
    try {
      const settings = await window.api.getSettings();
      set({ settings: { ...DEFAULT_SETTINGS, ...settings }, isLoaded: true });
    } catch (err) {
      console.error('[SettingsStore] Failed to load settings:', err);
      set({ isLoaded: true }); // still mark loaded so UI doesn't block
    }
  },

  save: async () => {
    try {
      await window.api.saveSettings(get().settings);
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err);
    }
  },
}));

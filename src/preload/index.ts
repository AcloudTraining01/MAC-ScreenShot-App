import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  // ── Preview ──
  onInitPreview: (callback: (imageUri: string) => void) => {
    const fn = (_event: any, uri: string) => callback(uri);
    ipcRenderer.on('init-preview', fn);
    return () => ipcRenderer.removeListener('init-preview', fn);
  },
  copyScreenshot: (dataUri: string) => ipcRenderer.send('copy-screenshot', dataUri),
  downloadScreenshot: (dataUri: string) => ipcRenderer.send('download-screenshot', dataUri),
  closePreview: () => ipcRenderer.send('close-preview'),

  // ── Editor ──
  openEditor: (dataUri: string) => ipcRenderer.send('open-editor', dataUri),
  onInitEditor: (callback: (imageUri: string) => void) => {
    const fn = (_event: any, uri: string) => callback(uri);
    ipcRenderer.on('init-editor', fn);
    return () => ipcRenderer.removeListener('init-editor', fn);
  },
  copyEdited: (dataUri: string) => ipcRenderer.send('copy-edited', dataUri),
  saveEdited: (dataUri: string) => ipcRenderer.send('save-edited', dataUri),
  closeEditor: () => ipcRenderer.send('close-editor'),

  // ── Library ──
  openLibrary: () => ipcRenderer.send('open-library'),
  getLibrary: () => ipcRenderer.invoke('get-library'),
  deleteScreenshot: (id: string) => ipcRenderer.send('delete-screenshot', id),
  openInEditor: (filePath: string) => ipcRenderer.send('open-in-editor', filePath),
  openInFinder: (filePath: string) => ipcRenderer.send('open-in-finder', filePath),
  closeLibrary: () => ipcRenderer.send('close-library'),
  onLibraryUpdated: (callback: () => void) => {
    const fn = () => callback();
    ipcRenderer.on('library-updated', fn);
    return () => ipcRenderer.removeListener('library-updated', fn);
  },
  /** Persist OCR-extracted text for a library entry */
  updateOcrText: (id: string, ocrText: string) =>
    ipcRenderer.send('update-ocr-text', id, ocrText),

  // ── Theme ──
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback: (theme: string) => void) => {
    const fn = (_event: any, theme: string) => callback(theme);
    ipcRenderer.on('theme-changed', fn);
    return () => ipcRenderer.removeListener('theme-changed', fn);
  },

  // ── Settings ──
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke('save-settings', settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const fn = (_event: any, s: AppSettings) => callback(s);
    ipcRenderer.on('settings-changed', fn);
    return () => ipcRenderer.removeListener('settings-changed', fn);
  },
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('pick-directory'),

  // ── Onboarding ──
  checkScreenPermission: (): Promise<string> => ipcRenderer.invoke('check-screen-permission'),
  requestScreenPermission: (): Promise<string> => ipcRenderer.invoke('request-screen-permission'),
  completeOnboarding: () => ipcRenderer.send('complete-onboarding'),
  skipOnboarding: () => ipcRenderer.send('skip-onboarding'),

  // ── Licensing ──
  getTier: (): Promise<import('../shared/types').LicenseValidationResult> =>
    ipcRenderer.invoke('get-tier'),
  activateLicense: (key: string): Promise<import('../shared/types').LicenseValidationResult> =>
    ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.send('deactivate-license'),
  onLicenseChanged: (
    callback: (result: import('../shared/types').LicenseValidationResult) => void
  ) => {
    const fn = (_event: any, result: import('../shared/types').LicenseValidationResult) =>
      callback(result);
    ipcRenderer.on('license-changed', fn);
    return () => ipcRenderer.removeListener('license-changed', fn);
  },
});

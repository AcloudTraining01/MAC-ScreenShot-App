import { contextBridge, ipcRenderer } from 'electron';

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

  // ── Theme ──
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback: (theme: string) => void) => {
    const fn = (_event: any, theme: string) => callback(theme);
    ipcRenderer.on('theme-changed', fn);
    return () => ipcRenderer.removeListener('theme-changed', fn);
  }
});

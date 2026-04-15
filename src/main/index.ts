import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  clipboard,
  nativeImage,
  nativeTheme,
  globalShortcut,
  dialog,
  systemPreferences,
  shell
} from 'electron';
import { join, join as pathJoin, basename } from 'path';
import { exec } from 'child_process';
import { tmpdir, homedir } from 'os';
import { existsSync, unlinkSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { createTray, destroyTray } from './tray';

let previewWindow: BrowserWindow | null = null;
let editorWindow: BrowserWindow | null = null;
let libraryWindow: BrowserWindow | null = null;
let isCapturing = false;

// ─── Library paths ─────────────────────────────────────────────────────────
const LIBRARY_DIR = pathJoin(homedir(), 'Pictures', 'SnapForge');
const LIBRARY_INDEX = pathJoin(homedir(), '.snapforge', 'library.json');

function ensureLibraryPaths(): void {
  if (!existsSync(LIBRARY_DIR)) mkdirSync(LIBRARY_DIR, { recursive: true });
  const configDir = pathJoin(homedir(), '.snapforge');
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  if (!existsSync(LIBRARY_INDEX)) writeFileSync(LIBRARY_INDEX, '[]', 'utf-8');
}

interface LibraryEntry {
  id: string;
  filename: string;
  path: string;
  timestamp: number;
  width: number;
  height: number;
  fileSize: number;
}

function readLibraryIndex(): LibraryEntry[] {
  try {
    ensureLibraryPaths();
    return JSON.parse(readFileSync(LIBRARY_INDEX, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLibraryIndex(entries: LibraryEntry[]): void {
  ensureLibraryPaths();
  writeFileSync(LIBRARY_INDEX, JSON.stringify(entries, null, 2), 'utf-8');
}

function saveToLibrary(dataUri: string): LibraryEntry | null {
  try {
    ensureLibraryPaths();
    const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64Data, 'base64');
    const img = nativeImage.createFromBuffer(buf);
    const size = img.getSize();
    const ts = Date.now();
    const filename = `snapforge-${ts}.png`;
    const filePath = pathJoin(LIBRARY_DIR, filename);
    writeFileSync(filePath, buf);

    const entry: LibraryEntry = {
      id: ts.toString(),
      filename,
      path: filePath,
      timestamp: ts,
      width: size.width,
      height: size.height,
      fileSize: buf.length
    };

    const index = readLibraryIndex();
    index.unshift(entry);
    writeLibraryIndex(index);
    console.log('[Library] Saved:', filename, `${size.width}x${size.height}`);
    return entry;
  } catch (err) {
    console.error('[Library] Failed to save:', err);
    return null;
  }
}

// ─── Auto-launch on login ──────────────────────────────────────────────────
function setupAutoLaunch(): void {
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    });
  }
}

// ─── Screenshot capture using native macOS interactive selection ───────────
async function captureScreenInteractive(): Promise<string | null> {
  return new Promise((resolve) => {
    const tmpPath = pathJoin(tmpdir(), `snapforge-${Date.now()}.png`);
    exec(`screencapture -i -x "${tmpPath}"`, (err) => {
      if (err) {
        console.error('[Capture] screencapture failed:', err);
        resolve(null);
        return;
      }
      if (!existsSync(tmpPath)) {
        console.log('[Capture] User cancelled selection.');
        resolve(null);
        return;
      }
      try {
        const buf = readFileSync(tmpPath);
        const dataUri = 'data:image/png;base64,' + buf.toString('base64');
        unlinkSync(tmpPath);
        resolve(dataUri);
      } catch (e) {
        console.error('[Capture] Failed to read capture file:', e);
        resolve(null);
      }
    });
  });
}

// ─── Main capture flow ─────────────────────────────────────────────────────
async function startCapture(): Promise<void> {
  if (isCapturing) return;
  isCapturing = true;
  try {
    console.log('[Capture] Starting interactive screen capture...');
    const imageUri = await captureScreenInteractive();
    if (imageUri) {
      console.log('[Capture] Screenshot taken, saving to library & opening preview...');
      saveToLibrary(imageUri);
      createPreviewWindow(imageUri);
    } else {
      console.log('[Capture] No image captured (user may have cancelled).');
    }
  } catch (error) {
    console.error('[Capture] Unexpected error:', error);
  } finally {
    isCapturing = false;
  }
}

// ─── Preview Window ────────────────────────────────────────────────────────
function createPreviewWindow(dataUri: string): void {
  closePreview();
  closeEditor();

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.min(800, workArea.width - 100);
  const winHeight = Math.min(600, workArea.height - 100);

  previewWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    resizable: true,
    center: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  previewWindow.on('closed', () => {
    previewWindow = null;
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    previewWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#preview');
  } else {
    previewWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'preview' });
  }

  previewWindow.webContents.on('did-finish-load', () => {
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.webContents.send('init-preview', dataUri);
    }
  });
}

// ─── Editor Window ─────────────────────────────────────────────────────────
function createEditorWindow(dataUri: string): void {
  closeEditor();

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workAreaSize;
  const winWidth = Math.round(workArea.width * 0.9);
  const winHeight = Math.round(workArea.height * 0.9);

  editorWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    transparent: false,
    backgroundColor: '#18181c',
    alwaysOnTop: false,
    skipTaskbar: false,
    hasShadow: true,
    resizable: true,
    center: true,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    editorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#editor');
  } else {
    editorWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'editor' });
  }

  editorWindow.webContents.on('did-finish-load', () => {
    if (editorWindow && !editorWindow.isDestroyed()) {
      editorWindow.webContents.send('init-editor', dataUri);
    }
  });
}

// ─── Library Window ────────────────────────────────────────────────────────
function createLibraryWindow(): void {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.focus();
    return;
  }

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.round(workArea.width * 0.75);
  const winHeight = Math.round(workArea.height * 0.8);

  libraryWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    transparent: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#18181c' : '#f5f5f7',
    alwaysOnTop: false,
    skipTaskbar: false,
    hasShadow: true,
    resizable: true,
    center: true,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  libraryWindow.on('closed', () => {
    libraryWindow = null;
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    libraryWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#library');
  } else {
    libraryWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'library' });
  }
}

// ─── Close helpers ─────────────────────────────────────────────────────────
function closePreview(): void {
  if (previewWindow && !previewWindow.isDestroyed()) previewWindow.close();
  previewWindow = null;
}

function closeEditor(): void {
  if (editorWindow && !editorWindow.isDestroyed()) editorWindow.close();
  editorWindow = null;
}

function closeLibrary(): void {
  if (libraryWindow && !libraryWindow.isDestroyed()) libraryWindow.close();
  libraryWindow = null;
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────
function setupIPC(): void {
  // ── Preview actions ──
  ipcMain.on('copy-screenshot', (_event, dataUri: string) => {
    setTimeout(() => {
      try {
        const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
        const image = nativeImage.createFromBuffer(Buffer.from(base64Data, 'base64'));
        clipboard.writeImage(image);
        console.log('[IPC] Screenshot copied to clipboard.');
      } catch (err) {
        console.error('[IPC] Failed to copy screenshot:', err);
      }
      closePreview();
    }, 0);
  });

  ipcMain.on('download-screenshot', async (_event, dataUri: string) => {
    setTimeout(async () => {
      const win = previewWindow;
      try {
        const parentWin = win && !win.isDestroyed() ? win : undefined;
        const options = {
          title: 'Save Screenshot',
          defaultPath: pathJoin(homedir(), 'Desktop', `screenshot-${Date.now()}.png`),
          filters: [{ name: 'PNG Image', extensions: ['png'] }]
        };
        const result = parentWin 
          ? await dialog.showSaveDialog(parentWin as BrowserWindow, options)
          : await dialog.showSaveDialog(options);

        if (!result.canceled && result.filePath) {
          const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
          writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
          console.log('[IPC] Screenshot saved to', result.filePath);
        }
      } catch (err) {
        console.error('[IPC] Failed to save screenshot:', err);
      }
      closePreview();
    }, 0);
  });

  ipcMain.on('close-preview', () => {
    setTimeout(() => closePreview(), 0);
  });

  // ── Editor flow ──
  ipcMain.on('open-editor', (_event, dataUri: string) => {
    setTimeout(() => {
      console.log('[IPC] Opening editor...');
      closePreview();
      createEditorWindow(dataUri);
    }, 0);
  });

  ipcMain.on('copy-edited', (_event, dataUri: string) => {
    setTimeout(() => {
      try {
        const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
        const image = nativeImage.createFromBuffer(Buffer.from(base64Data, 'base64'));
        clipboard.writeImage(image);
        console.log('[IPC] Edited image copied to clipboard.');
      } catch (err) {
        console.error('[IPC] Failed to copy edited image:', err);
      }
      closeEditor();
    }, 0);
  });

  ipcMain.on('save-edited', async (_event, dataUri: string) => {
    setTimeout(async () => {
      const win = editorWindow;
      try {
        const parentWin = win && !win.isDestroyed() ? win : undefined;
        const options = {
          title: 'Save Edited Screenshot',
          defaultPath: pathJoin(homedir(), 'Desktop', `snapforge-${Date.now()}.png`),
          filters: [{ name: 'PNG Image', extensions: ['png'] }]
        };
        const result = parentWin
          ? await dialog.showSaveDialog(parentWin as BrowserWindow, options)
          : await dialog.showSaveDialog(options);

        if (!result.canceled && result.filePath) {
          const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
          writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
          console.log('[IPC] Edited image saved to', result.filePath);
        }
      } catch (err) {
        console.error('[IPC] Failed to save edited image:', err);
      }
      closeEditor();
    }, 0);
  });

  ipcMain.on('close-editor', () => {
    setTimeout(() => closeEditor(), 0);
  });

  // ── Library ──
  ipcMain.on('open-library', () => {
    setTimeout(() => createLibraryWindow(), 0);
  });

  ipcMain.handle('get-library', () => {
    return readLibraryIndex();
  });

  ipcMain.on('delete-screenshot', (_event, id: string) => {
    setTimeout(() => {
      try {
        const index = readLibraryIndex();
        const entry = index.find((e) => e.id === id);
        if (entry && existsSync(entry.path)) {
          unlinkSync(entry.path);
        }
        const newIndex = index.filter((e) => e.id !== id);
        writeLibraryIndex(newIndex);
        console.log('[Library] Deleted:', id);
        // Notify library window to refresh
        if (libraryWindow && !libraryWindow.isDestroyed()) {
          libraryWindow.webContents.send('library-updated');
        }
      } catch (err) {
        console.error('[Library] Failed to delete:', err);
      }
    }, 0);
  });

  ipcMain.on('open-in-editor', (_event, filePath: string) => {
    setTimeout(() => {
      try {
        const buf = readFileSync(filePath);
        const dataUri = 'data:image/png;base64,' + buf.toString('base64');
        createEditorWindow(dataUri);
      } catch (err) {
        console.error('[Library] Failed to open in editor:', err);
      }
    }, 0);
  });

  ipcMain.on('open-in-finder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.on('close-library', () => {
    setTimeout(() => closeLibrary(), 0);
  });

  // ── Theme ──
  ipcMain.handle('get-system-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // Broadcast theme changes to all windows
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    const allWindows = [previewWindow, editorWindow, libraryWindow];
    for (const win of allWindows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('theme-changed', theme);
      }
    }
  });
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    if (status !== 'granted') {
      console.warn('[Permissions] Screen recording not granted. macOS will prompt on first capture.');
    }
  }

  setupAutoLaunch();
  setupIPC();
  createTray(startCapture, () => {
    ipcMain.emit('open-library');
  });

  const ret = globalShortcut.register('CmdOrCtrl+Shift+4', () => {
    console.log('[Hotkey] CmdOrCtrl+Shift+4 pressed');
    startCapture();
  });
  if (!ret) {
    console.warn('[Hotkey] Failed to register CmdOrCtrl+Shift+4');
  }

  const retLib = globalShortcut.register('CmdOrCtrl+Shift+L', () => {
    console.log('[Hotkey] CmdOrCtrl+Shift+L pressed');
    createLibraryWindow();
  });
  if (!retLib) {
    console.warn('[Hotkey] Failed to register CmdOrCtrl+Shift+L');
  }

  console.log('✅ SnapForge is running in the menu bar!');
  console.log('   Click the tray icon or press ⌘+Shift+4 to capture.');
  if (!app.isPackaged) {
    console.log('   [dev mode] auto-launch disabled in dev mode');
  }
});

app.on('will-quit', () => {
  destroyTray();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

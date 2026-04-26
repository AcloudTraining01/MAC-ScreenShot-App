/**
 * Onboarding Module — manages the first-launch onboarding window.
 *
 * Responsibilities:
 *  - Detect whether this is a first launch (hasCompletedOnboarding === false)
 *  - Create and manage the onboarding BrowserWindow
 *  - Handle IPC: permission checks, permission requests, completion
 *
 * All permission logic is delegated to the platform adapter so this module
 * stays 100% cross-platform.
 */
import {
  BrowserWindow,
  ipcMain,
  nativeTheme,
  app,
} from 'electron';
import { join } from 'path';
import { platform } from './platform';

let onboardingWindow: BrowserWindow | null = null;

/** Create and show the onboarding window */
export function createOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus();
    return;
  }

  onboardingWindow = new BrowserWindow({
    width: 680,
    height: 500,
    frame: false,
    transparent: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#18181c' : '#f5f5f7',
    alwaysOnTop: true,         // Stay on top so user sees it immediately
    skipTaskbar: false,
    hasShadow: true,
    resizable: false,
    center: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    onboardingWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#onboarding');
  } else {
    onboardingWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'onboarding',
    });
  }

  console.log('[Onboarding] Window opened.');
}

export function closeOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close();
  }
  onboardingWindow = null;
}

/**
 * Register all onboarding-related IPC handlers.
 * Call once during app initialisation.
 *
 * @param onComplete   Called when the user finishes or skips onboarding
 */
export function setupOnboardingIPC(onComplete: () => void): void {
  // Renderer asks for current permission status via the platform adapter
  ipcMain.handle('check-screen-permission', () => {
    return platform.checkScreenCapturePermission();
  });

  // Renderer asks us to open the OS permission UI
  ipcMain.handle('request-screen-permission', async () => {
    await platform.requestScreenCapturePermission();
    // Return the (possibly updated) status
    return platform.checkScreenCapturePermission();
  });

  // User clicked "Start Capturing" — onboarding complete
  ipcMain.on('complete-onboarding', () => {
    console.log('[Onboarding] Completed by user.');
    onComplete();
    closeOnboardingWindow();
  });

  // User explicitly skipped onboarding
  ipcMain.on('skip-onboarding', () => {
    console.log('[Onboarding] Skipped by user.');
    onComplete();
    closeOnboardingWindow();
  });
}

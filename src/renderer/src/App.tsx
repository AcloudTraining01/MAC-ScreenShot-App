import React from 'react';
import PreviewWindow from './components/PreviewWindow';
import EditorWindow from './components/EditorWindow';
import LibraryWindow from './components/LibraryWindow';
import SettingsWindow from './components/SettingsWindow';
import OnboardingWindow from './components/OnboardingWindow';
import type { AppSettings, LibraryEntry, LicenseValidationResult } from '../../shared/types';

declare global {
  interface Window {
    api: {
      // ── Preview ──
      onInitPreview: (callback: (uri: string) => void) => () => void;
      copyScreenshot: (uri: string) => void;
      downloadScreenshot: (uri: string) => void;
      closePreview: () => void;
      // ── Editor ──
      openEditor: (uri: string) => void;
      onInitEditor: (callback: (uri: string) => void) => () => void;
      copyEdited: (uri: string) => void;
      saveEdited: (uri: string) => void;
      closeEditor: () => void;
      // ── Library ──
      openLibrary: () => void;
      getLibrary: () => Promise<LibraryEntry[]>;
      deleteScreenshot: (id: string) => void;
      openInEditor: (filePath: string) => void;
      openInFinder: (filePath: string) => void;
      closeLibrary: () => void;
      onLibraryUpdated: (callback: () => void) => () => void;
      updateOcrText: (id: string, ocrText: string) => void;
      // ── Theme ──
      getSystemTheme: () => Promise<'dark' | 'light'>;
      onThemeChanged: (callback: (theme: string) => void) => () => void;
      // ── Settings ──
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<AppSettings>;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
      openSettings: () => void;
      closeSettings: () => void;
      pickDirectory: () => Promise<string | null>;
      // ── Onboarding ──
      checkScreenPermission: () => Promise<string>;
      requestScreenPermission: () => Promise<string>;
      completeOnboarding: () => void;
      skipOnboarding: () => void;
      // ── Licensing ──
      getTier: () => Promise<LicenseValidationResult>;
      activateLicense: (key: string) => Promise<LicenseValidationResult>;
      deactivateLicense: () => void;
      onLicenseChanged: (callback: (result: LicenseValidationResult) => void) => () => void;
    };
  }
}

const App: React.FC = () => {
  const hash = window.location.hash;

  if (hash === '#editor')     return <EditorWindow />;
  if (hash === '#library')    return <LibraryWindow />;
  if (hash === '#settings')   return <SettingsWindow />;
  if (hash === '#onboarding') return <OnboardingWindow />;

  // Default: preview window
  return <PreviewWindow />;
};

export default App;

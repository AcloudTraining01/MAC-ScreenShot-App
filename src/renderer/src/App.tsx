import React from 'react';
import PreviewWindow from './components/PreviewWindow';
import EditorWindow from './components/EditorWindow';
import LibraryWindow from './components/LibraryWindow';

declare global {
  interface Window {
    api: {
      // Preview
      onInitPreview: (callback: (uri: string) => void) => () => void;
      copyScreenshot: (uri: string) => void;
      downloadScreenshot: (uri: string) => void;
      closePreview: () => void;
      // Editor
      openEditor: (uri: string) => void;
      onInitEditor: (callback: (uri: string) => void) => () => void;
      copyEdited: (uri: string) => void;
      saveEdited: (uri: string) => void;
      closeEditor: () => void;
      // Library
      openLibrary: () => void;
      getLibrary: () => Promise<any[]>;
      deleteScreenshot: (id: string) => void;
      openInEditor: (filePath: string) => void;
      openInFinder: (filePath: string) => void;
      closeLibrary: () => void;
      onLibraryUpdated: (callback: () => void) => () => void;
      // Theme
      getSystemTheme: () => Promise<'dark' | 'light'>;
      onThemeChanged: (callback: (theme: string) => void) => () => void;
    };
  }
}

const App: React.FC = () => {
  const hash = window.location.hash;

  if (hash === '#editor') {
    return <EditorWindow />;
  }

  if (hash === '#library') {
    return <LibraryWindow />;
  }

  // Default: preview window
  return <PreviewWindow />;
};

export default App;

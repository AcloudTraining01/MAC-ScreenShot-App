import React from 'react';
import PreviewWindow from './components/PreviewWindow';
import EditorWindow from './components/EditorWindow';
import LibraryWindow from './components/LibraryWindow';
import SettingsWindow from './components/SettingsWindow';
import OnboardingWindow from './components/OnboardingWindow';

// `window.api` is declared once, in src/preload/api.d.ts, and augments the
// global scope from there. Nothing to redeclare here.

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

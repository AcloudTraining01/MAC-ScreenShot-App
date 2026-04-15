import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ── System-Aware Dark/Light Theme ──
// Uses Electron's nativeTheme via IPC, with CSS media-query fallback
function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

async function initTheme(): Promise<void> {
  try {
    // Primary: ask main process for the OS theme
    const theme = await window.api.getSystemTheme();
    applyTheme(theme);

    // Listen for live changes (user toggles system appearance)
    window.api.onThemeChanged((newTheme: string) => {
      applyTheme(newTheme as 'dark' | 'light');
    });
  } catch {
    // Fallback: use CSS media query result (works without IPC)
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(isDark ? 'dark' : 'light');

    // Listen for OS changes via media query
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      applyTheme(e.matches ? 'dark' : 'light');
    });
  }
}

initTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import type { AppSettings } from '../../../shared/types';
import '../styles/settings.css';

// ── Types ────────────────────────────────────────────────────────────────────
type TabId = 'shortcuts' | 'capture' | 'general' | 'about';

interface NavItem {
  id: TabId;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'shortcuts', icon: '⌨️', label: 'Shortcuts' },
  { id: 'capture',   icon: '📸', label: 'Capture' },
  { id: 'general',   icon: '⚙️', label: 'General' },
  { id: 'about',     icon: 'ℹ️', label: 'About' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Parse an Electron accelerator string into display-friendly key tokens */
function parseAccelerator(accel: string): string[] {
  if (!accel) return [];
  return accel
    .split('+')
    .map((k) => {
      switch (k) {
        case 'CmdOrCtrl': return '⌘';
        case 'Cmd':       return '⌘';
        case 'Ctrl':      return '⌃';
        case 'Shift':     return '⇧';
        case 'Alt':       return '⌥';
        case 'Option':    return '⌥';
        default:          return k.toUpperCase();
      }
    });
}

/** Convert a KeyboardEvent into an Electron accelerator string */
function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  // Require at least one modifier for global shortcuts
  const hasMod = e.metaKey || e.ctrlKey || e.altKey;
  if (!hasMod) return null;

  if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey)   parts.push('Alt');

  const ignoredKeys = new Set([
    'Meta', 'Control', 'Shift', 'Alt', 'CapsLock',
    'Tab', 'Escape', 'Enter',
  ]);

  if (e.key && !ignoredKeys.has(e.key)) {
    parts.push(e.key.toUpperCase());
  } else {
    return null; // not a complete shortcut yet
  }

  return parts.join('+');
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Toggle switch */
function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <label className="settings-toggle" htmlFor={id} aria-label="toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" />
    </label>
  );
}

/** Hotkey recorder */
function HotkeyRecorder({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (accel: string) => void;
  id: string;
}) {
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const startRecording = () => setRecording(true);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }

      const accel = eventToAccelerator(e);
      if (accel) {
        onChange(accel);
        setRecording(false);
      }
    },
    [recording, onChange]
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [recording, handleKeyDown]);

  // Dismiss on outside click
  useEffect(() => {
    if (!recording) return;
    const onBlur = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setRecording(false);
      }
    };
    window.addEventListener('mousedown', onBlur);
    return () => window.removeEventListener('mousedown', onBlur);
  }, [recording]);

  const keys = parseAccelerator(value);

  return (
    <div
      id={id}
      ref={ref}
      className={`hotkey-display ${recording ? 'recording' : ''}`}
      onClick={startRecording}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && startRecording()}
      aria-label={`Hotkey: ${value}. Click to change.`}
    >
      {recording ? (
        <span className="hotkey-record-hint">Press your shortcut… (Esc to cancel)</span>
      ) : (
        <>
          {keys.map((k, i) => (
            <span key={i} className="hotkey-key">{k}</span>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
const SettingsWindow: React.FC = () => {
  const { settings, setSettings, save } = useSettingsStore();
  const { tier } = useAuthStore();
  const isPro = tier === 'pro';

  const [activeTab, setActiveTab] = useState<TabId>('shortcuts');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  // Load from main on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s);
      setLocalSettings(s);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.api.closeSettings();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSettings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSettings(localSettings);
    await window.api.saveSettings(localSettings);
    setSaveStatus('saved');
    setIsDirty(false);
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handlePickDirectory = async () => {
    const dir = await window.api.pickDirectory();
    if (dir) update('saveDirectory', dir);
  };

  const displayDir = localSettings.saveDirectory || '~/Pictures/SnapForge (default)';

  return (
    <div className="settings-container">
      {/* ── Header ── */}
      <div className="settings-header">
        <div className="settings-header-left">
          <h1 className="settings-title">⚙️ Preferences</h1>
          <span className="settings-version">v1.0.2</span>
        </div>
        <button
          className="settings-close-btn"
          onClick={() => window.api.closeSettings()}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div className="settings-body">
        {/* Sidebar */}
        <nav className="settings-sidebar" aria-label="Settings sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`settings-nav-${item.id}`}
              className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">
          {/* ── Shortcuts Tab ── */}
          {activeTab === 'shortcuts' && (
            <>
              <p className="settings-section-title">Keyboard Shortcuts</p>
              <div className="settings-group">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Capture Screenshot</span>
                    <span className="settings-row-desc">
                      Trigger interactive region capture from anywhere
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <HotkeyRecorder
                      id="hotkey-capture"
                      value={localSettings.captureHotkey}
                      onChange={(v) => update('captureHotkey', v)}
                    />
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Open Library</span>
                    <span className="settings-row-desc">
                      Open the screenshot library window
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <HotkeyRecorder
                      id="hotkey-library"
                      value={localSettings.libraryHotkey}
                      onChange={(v) => update('libraryHotkey', v)}
                    />
                  </div>
                </div>
              </div>

              <p className="settings-section-title" style={{ marginTop: 0 }}>Tips</p>
              <div className="settings-group">
                <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span className="settings-row-label">How to record a shortcut</span>
                  <span className="settings-row-desc">
                    Click the shortcut field above, then press your desired key combination
                    (e.g. ⌘⇧2). Press Esc to cancel. Shortcuts require at least one modifier
                    key (⌘, ⌃, ⌥, or ⇧ with another modifier).
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── Capture Tab ── */}
          {activeTab === 'capture' && (
            <>
              <p className="settings-section-title">Capture Behaviour</p>
              <div className="settings-group">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Auto-save to Library</span>
                    <span className="settings-row-desc">
                      Automatically save every capture to your screenshot library
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <Toggle
                      id="toggle-autosave"
                      checked={localSettings.autoSaveToLibrary}
                      onChange={(v) => update('autoSaveToLibrary', v)}
                    />
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Copy to Clipboard on Capture</span>
                    <span className="settings-row-desc">
                      Immediately copy the screenshot to your clipboard after capturing
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <Toggle
                      id="toggle-copy"
                      checked={localSettings.copyOnCapture}
                      onChange={(v) => update('copyOnCapture', v)}
                    />
                  </div>
                </div>
              </div>

              <p className="settings-section-title">Save Location</p>
              <div className="settings-group">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Default Save Folder</span>
                    <span className="settings-row-desc">
                      Where the "Save As…" dialog starts by default
                    </span>
                  </div>
                  <div className="settings-row-right settings-path-wrapper">
                    <span className="settings-path-display" title={displayDir}>
                      {displayDir}
                    </span>
                    <button className="settings-path-btn" onClick={handlePickDirectory}>
                      Browse…
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── General Tab ── */}
          {activeTab === 'general' && (
            <>
              <p className="settings-section-title">Appearance</p>
              <div className="settings-group">
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Theme</span>
                    <span className="settings-row-desc">
                      Choose light, dark, or follow your system setting
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <select
                      id="select-theme"
                      className="settings-select"
                      value={localSettings.theme}
                      onChange={(e) =>
                        update('theme', e.target.value as AppSettings['theme'])
                      }
                    >
                      <option value="system">System Default</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>
                </div>
              </div>

              <p className="settings-section-title">System</p>
              <div className="settings-group">
                <div className={`settings-row ${!isPro ? 'pro-locked' : ''}`}>
                  <div className="settings-row-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="settings-row-label">Launch at Login</span>
                      {!isPro && <span className="pro-badge">⭐ Pro</span>}
                    </div>
                    <span className="settings-row-desc">
                      Start SnapForge automatically when you log in to your Mac
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <Toggle
                      id="toggle-login"
                      checked={localSettings.launchOnLogin}
                      onChange={(v) => update('launchOnLogin', v)}
                      disabled={!isPro}
                    />
                  </div>
                </div>
              </div>

              {!isPro && (
                <div className="feature-gate-prompt" style={{ marginBottom: 24 }}>
                  <span className="feature-gate-icon">⭐</span>
                  <div className="feature-gate-content">
                    <span className="feature-gate-label">SnapForge Pro</span>
                    <span className="feature-gate-reason">
                      Unlock Launch at Login, unlimited library, AI Smart Redact, and more.
                    </span>
                  </div>
                  <button
                    className="feature-gate-btn"
                    onClick={() => alert('Upgrade to SnapForge Pro — coming soon!')}
                  >
                    ⬆ Upgrade
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── About Tab ── */}
          {activeTab === 'about' && (
            <div className="settings-about">
              <div className="about-logo">📸</div>
              <h2 className="about-name">SnapForge</h2>
              <p className="about-tagline">
                Premium screenshot utility for macOS &amp; Windows
              </p>
              <div className="about-version-badge">Version 1.0.2</div>

              <div className="about-links">
                <button
                  className="about-link-btn"
                  onClick={() =>
                    window.open(
                      'https://github.com/AcloudTraining01/MAC-ScreenShot-App',
                      '_blank'
                    )
                  }
                >
                  📖 GitHub
                </button>
                <button
                  className="about-link-btn"
                  onClick={() =>
                    window.open(
                      'https://github.com/AcloudTraining01/MAC-ScreenShot-App/issues',
                      '_blank'
                    )
                  }
                >
                  🐛 Report Bug
                </button>
              </div>

              <div className="settings-group" style={{ width: '100%', marginTop: 24 }}>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-row-label">Subscription</span>
                    <span className="settings-row-desc">Current plan</span>
                  </div>
                  <div className="settings-row-right">
                    {isPro ? (
                      <span className="pro-badge">⭐ Pro</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Free</span>
                        <button
                          className="feature-gate-btn"
                          style={{ marginLeft: 8 }}
                          onClick={() => alert('Upgrade coming soon!')}
                        >
                          ⬆ Upgrade
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="settings-footer">
        {saveStatus === 'saved' && (
          <span className="settings-save-status">✓ Settings saved</span>
        )}
        <button onClick={() => window.api.closeSettings()}>Cancel</button>
        <button
          className="primary"
          onClick={handleSave}
          disabled={!isDirty || saveStatus === 'saving'}
          id="settings-save-btn"
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsWindow;

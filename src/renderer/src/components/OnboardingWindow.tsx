import React, { useEffect, useState } from 'react';
import '../styles/onboarding.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'welcome' | 'shortcuts' | 'done';

const STEPS: Step[] = ['welcome', 'shortcuts', 'done'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAccelerator(accel: string): string[] {  return accel.split('+').map((k) => {
    switch (k) {
      case 'CmdOrCtrl': return '⌘';
      case 'Shift':     return '⇧';
      case 'Alt':       return '⌥';
      case 'Ctrl':      return '⌃';
      default:          return k.toUpperCase();
    }
  });
}

// ── Step Components ───────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <>
      <div className="onboarding-icon">📸</div>
      <h1 className="onboarding-title">Welcome to SnapForge</h1>
      <p className="onboarding-subtitle">
        A premium screenshot utility that captures, annotates, and shares with
        style. Let's get you set up in just a few steps.
      </p>
      <div className="onboarding-features">
        {[
          { icon: '✂️', label: 'Region Capture' },
          { icon: '🎨', label: 'Annotation Editor' },
          { icon: '📚', label: 'Screenshot Library' },
          { icon: '✨', label: 'Beautifier' },
          { icon: '📄', label: 'OCR Text Extract' },
          { icon: '🔐', label: 'Smart Redact' },
        ].map((f) => (
          <div key={f.label} className="feature-pill">
            <span className="feature-pill-icon">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>
    </>
  );
}

interface ShortcutsStepProps {
  captureHotkey: string;
  libraryHotkey: string;
}

function ShortcutsStep({ captureHotkey, libraryHotkey }: ShortcutsStepProps) {
  return (
    <>
      <div className="onboarding-icon">⌨️</div>
      <h1 className="onboarding-title">Your Shortcuts</h1>
      <p className="onboarding-subtitle">
        These global shortcuts work from anywhere on your Mac, even when
        SnapForge is in the background. You can change them anytime in Preferences.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 440, marginBottom: 8 }}>
        {[
          {
            label: 'Capture Screenshot',
            desc: 'Interactive region selection',
            hotkey: captureHotkey,
          },
          {
            label: 'Open Library',
            desc: 'Browse all your screenshots',
            hotkey: libraryHotkey,
          },
        ].map((s) => (
          <div key={s.label} className="shortcut-preview">
            <div className="shortcut-preview-left">
              <p className="shortcut-preview-label">{s.label}</p>
              <p className="shortcut-preview-desc">{s.desc}</p>
            </div>
            <div className="shortcut-keys">
              {parseAccelerator(s.hotkey).map((k, i) => (
                <span key={i} className="shortcut-key">{k}</span>
              ))}
            </div>
          </div>
        ))}

        <div className="shortcut-preview">
          <div className="shortcut-preview-left">
            <p className="shortcut-preview-label">Tray Icon</p>
            <p className="shortcut-preview-desc">Left-click the 📸 menu bar icon to capture instantly</p>
          </div>
          <div className="shortcut-keys">
            <span className="shortcut-key" style={{ fontSize: 18 }}>📸</span>
          </div>
        </div>
      </div>
    </>
  );
}

function DoneStep() {
  return (
    <>
      <div className="onboarding-icon" style={{ animation: 'none' }}>🎉</div>
      <h1 className="onboarding-title">You're All Set!</h1>
      <p className="onboarding-subtitle">
        SnapForge is ready. It lives in your menu bar — capture anytime, edit
        in seconds, and find everything in your library.
      </p>

      <div className="onboarding-done-grid">
        {[
          { icon: '📸', label: 'Capture', desc: 'Hotkey or click the menu bar icon' },
          { icon: '🎨', label: 'Annotate', desc: 'Arrows, text, shapes & more' },
          { icon: '📚', label: 'Library', desc: 'Every screenshot saved & searchable' },
          { icon: '⚙️', label: 'Preferences', desc: 'Right-click the tray icon' },
        ].map((c) => (
          <div key={c.label} className="done-card">
            <span className="done-card-icon">{c.icon}</span>
            <span className="done-card-label">{c.label}</span>
            <span className="done-card-desc">{c.desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressDots({ current }: { current: number }) {
  return (
    <div className="onboarding-progress">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={`progress-dot ${
            i === current ? 'active' : i < current ? 'completed' : ''
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const OnboardingWindow: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [captureHotkey, setCaptureHotkey] = useState('CmdOrCtrl+Shift+4');
  const [libraryHotkey, setLibraryHotkey] = useState('CmdOrCtrl+Shift+L');

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setCaptureHotkey(s.captureHotkey);
      setLibraryHotkey(s.libraryHotkey);
    });
  }, []);

  const nextLabel = () => {
    switch (currentStep) {
      case 'welcome':   return 'Get Started →';
      case 'shortcuts': return 'Continue →';
      case 'done':      return '🚀 Start Capturing';
      default:          return 'Continue →';
    }
  };

  const handleNext = () => {
    if (currentStep === 'done') {
      window.api.completeOnboarding();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSkip = () => {
    window.api.skipOnboarding();
  };

  return (
    <div className="onboarding-container">
      {/* Header drag region + skip */}
      <div className="onboarding-header">
        {currentStep !== 'done' && (
          <button className="onboarding-skip-btn" onClick={handleSkip}>
            Skip setup
          </button>
        )}
      </div>

      {/* Step content */}
      <div className="onboarding-body" key={currentStep}>
        {currentStep === 'welcome' && <WelcomeStep />}
        {currentStep === 'shortcuts' && (
          <ShortcutsStep
            captureHotkey={captureHotkey}
            libraryHotkey={libraryHotkey}
          />
        )}
        {currentStep === 'done' && <DoneStep />}
      </div>

      {/* Footer */}
      <div className="onboarding-footer">
        <div>
          {stepIndex > 0 && currentStep !== 'done' && (
            <button className="onboarding-btn-back" onClick={handleBack}>
              ← Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ProgressDots current={stepIndex} />
          <button
            className="primary onboarding-btn-next"
            onClick={handleNext}
            id="onboarding-next-btn"
          >
            {nextLabel()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWindow;

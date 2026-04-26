import React, { useEffect, useState, useCallback } from 'react';
import '../styles/onboarding.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'welcome' | 'permission' | 'shortcuts' | 'done';
type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted';

const STEPS: Step[] = ['welcome', 'permission', 'shortcuts', 'done'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAccelerator(accel: string): string[] {
  return accel.split('+').map((k) => {
    switch (k) {
      case 'CmdOrCtrl': return '⌘';
      case 'Shift':     return '⇧';
      case 'Alt':       return '⌥';
      case 'Ctrl':      return '⌃';
      default:          return k.toUpperCase();
    }
  });
}

function permissionInfo(status: PermissionStatus): {
  icon: string;
  badge: string;
  desc: string;
  badgeClass: string;
} {
  switch (status) {
    case 'granted':
      return {
        icon: '✅',
        badge: '✓ Granted',
        badgeClass: 'granted',
        desc: 'SnapForge has Screen Recording permission. You\'re all set!',
      };
    case 'denied':
      return {
        icon: '🚫',
        badge: '✗ Denied',
        badgeClass: 'denied',
        desc: 'Permission was denied. You\'ll need to re-enable it in System Settings.',
      };
    case 'restricted':
      return {
        icon: '🔒',
        badge: 'Restricted',
        badgeClass: 'denied',
        desc: 'Screen Recording is restricted by your organisation or MDM profile.',
      };
    default:
      return {
        icon: '⚠️',
        badge: 'Not Granted',
        badgeClass: 'not-determined',
        desc: 'SnapForge needs permission to capture your screen.',
      };
  }
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

interface PermissionStepProps {
  status: PermissionStatus;
  onRecheck: () => void;
  onOpenSettings: () => void;
  isChecking: boolean;
}

function PermissionStep({ status, onRecheck, onOpenSettings, isChecking }: PermissionStepProps) {
  const info = permissionInfo(status);
  const needsGrant = status !== 'granted';

  return (
    <>
      <div className="onboarding-icon">{needsGrant ? '🔐' : '✅'}</div>
      <h1 className="onboarding-title">Screen Recording Permission</h1>
      <p className="onboarding-subtitle">
        SnapForge needs Screen Recording permission to capture screenshots.
        This is required by macOS and your data never leaves your device.
      </p>

      <div className="permission-card">
        <div className="permission-status-row">
          <span className="permission-status-icon">{info.icon}</span>
          <div className="permission-status-text">
            <p className="permission-status-label">Screen Recording</p>
            <p className="permission-status-desc">{info.desc}</p>
          </div>
          <span className={`permission-status-badge ${info.badgeClass}`}>
            {info.badge}
          </span>
        </div>

        {needsGrant && (
          <div className="permission-steps">
            <p className="permission-steps-title">How to grant permission</p>
            <div className="permission-step-item">
              <span className="permission-step-num">1</span>
              <p className="permission-step-text">
                Click <strong>Open System Settings</strong> below
              </p>
            </div>
            <div className="permission-step-item">
              <span className="permission-step-num">2</span>
              <p className="permission-step-text">
                Go to <strong>Privacy &amp; Security → Screen &amp; System Audio Recording</strong>
              </p>
            </div>
            <div className="permission-step-item">
              <span className="permission-step-num">3</span>
              <p className="permission-step-text">
                Toggle on <strong>SnapForge</strong>, then click{' '}
                <strong>Check Again</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {needsGrant && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onOpenSettings}>
            🔧 Open System Settings
          </button>
          <button onClick={onRecheck} disabled={isChecking}>
            {isChecking ? 'Checking…' : '🔄 Check Again'}
          </button>
        </div>
      )}
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
  const [permStatus, setPermStatus] = useState<PermissionStatus>('not-determined');
  const [isChecking, setIsChecking] = useState(false);
  const [captureHotkey, setCaptureHotkey] = useState('CmdOrCtrl+Shift+4');
  const [libraryHotkey, setLibraryHotkey] = useState('CmdOrCtrl+Shift+L');

  const currentStep = STEPS[stepIndex];

  // Load initial data
  useEffect(() => {
    // Get permission status
    window.api.checkScreenPermission().then((s) => setPermStatus(s as PermissionStatus));
    // Get settings for hotkey display
    window.api.getSettings().then((s) => {
      setCaptureHotkey(s.captureHotkey);
      setLibraryHotkey(s.libraryHotkey);
    });
  }, []);

  const handleRecheck = useCallback(async () => {
    setIsChecking(true);
    const status = await window.api.checkScreenPermission();
    setPermStatus(status as PermissionStatus);
    setIsChecking(false);
  }, []);

  const handleOpenSystemSettings = useCallback(async () => {
    await window.api.requestScreenPermission();
    // Give macOS a moment then re-check
    setTimeout(handleRecheck, 1200);
  }, [handleRecheck]);

  const canProceed = () => {
    if (currentStep === 'permission') {
      // Allow proceeding even without permission (user may grant later)
      return true;
    }
    return true;
  };

  const nextLabel = () => {
    switch (currentStep) {
      case 'welcome':     return 'Get Started →';
      case 'permission':
        return permStatus === 'granted' ? 'Continue →' : 'Continue Anyway →';
      case 'shortcuts':   return 'Continue →';
      case 'done':        return '🚀 Start Capturing';
      default:            return 'Continue →';
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
        {currentStep === 'permission' && (
          <PermissionStep
            status={permStatus}
            onRecheck={handleRecheck}
            onOpenSettings={handleOpenSystemSettings}
            isChecking={isChecking}
          />
        )}
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
            disabled={!canProceed()}
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

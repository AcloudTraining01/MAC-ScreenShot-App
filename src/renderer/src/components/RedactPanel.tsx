import React, { useState } from 'react';
import { detectPII, type PIIMatch } from '../services/piiDetector';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { FeatureGate } from './FeatureGate';

interface RedactPanelProps {
  imageUri: string;
  onRedactAll: (matches: PIIMatch[]) => void;
  onClose: () => void;
}

// smart.redact is Pro-only — FeatureGate handles the locked state entirely
const RedactPanel: React.FC<RedactPanelProps> = ({ imageUri, onRedactAll, onClose }) => {
  return (
    <FeatureGate
      feature="smart.redact"
      fallback={<LockedRedact onClose={onClose} />}
    >
      <RedactPanelInner imageUri={imageUri} onRedactAll={onRedactAll} onClose={onClose} />
    </FeatureGate>
  );
};

// ── Pro-locked fallback ───────────────────────────────────────────────────────
function LockedRedact({ onClose }: { onClose: () => void }) {
  return (
    <div className="redact-panel">
      <div className="ocr-header">
        <span>🛡️ Smart Redact</span>
        <button className="icon-button-sm" onClick={onClose}>✕</button>
      </div>
      <div className="ocr-empty">
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>
          AI Smart Redact — Pro Feature
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          Automatically detect and redact emails, phone numbers, SSNs, credit
          cards, and more. Available on SnapForge Pro.
        </p>
        <button
          className="feature-gate-btn"
          onClick={() => alert('Upgrade to SnapForge Pro — coming soon!')}
        >
          ⭐ Go Pro
        </button>
      </div>
    </div>
  );
}

// ── Inner panel — only rendered for Pro users ─────────────────────────────────
function RedactPanelInner({ imageUri, onRedactAll, onClose }: RedactPanelProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [matches, setMatches] = useState<PIIMatch[]>([]);

  const runScan = async () => {
    setStatus('scanning');
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(imageUri, 'eng');
      const text = result.data.text;
      const piiMatches = detectPII(text);
      setMatches(piiMatches);
      setStatus('done');
    } catch (err) {
      console.error('[Redact] OCR/PII scan failed:', err);
      setStatus('done');
    }
  };

  const groupedByType = matches.reduce((acc, m) => {
    if (!acc[m.type]) acc[m.type] = [];
    acc[m.type].push(m);
    return acc;
  }, {} as Record<string, PIIMatch[]>);

  return (
    <div className="redact-panel">
      <div className="ocr-header">
        <span>🛡️ Smart Redact</span>
        <button className="icon-button-sm" onClick={onClose}>✕</button>
      </div>

      {status === 'idle' && (
        <div className="ocr-empty">
          <p>Scan your screenshot for sensitive data like emails, phone numbers, SSNs, and credit card numbers.</p>
          <button className="ocr-run-btn" onClick={runScan}>
            🔍 Scan for PII
          </button>
        </div>
      )}

      {status === 'scanning' && (
        <div className="ocr-loading">
          <p>Scanning for sensitive information…</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="loading-spinner" style={{
              width: 24, height: 24,
              border: '3px solid var(--btn-border)',
              borderTop: '3px solid var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="redact-results">
          {matches.length === 0 ? (
            <div className="redact-clean">
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No PII detected</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Your screenshot appears clean of sensitive data.
              </p>
            </div>
          ) : (
            <>
              <div className="redact-summary">
                <span className="redact-badge">{matches.length} items found</span>
              </div>

              <div className="redact-list">
                {Object.entries(groupedByType).map(([type, items]) => (
                  <div key={type} className="redact-group">
                    <div className="redact-group-header">
                      <span>{items[0].icon} {items[0].label}</span>
                      <span className="redact-group-count">{items.length}</span>
                    </div>
                    {items.map((m, i) => (
                      <div key={i} className="redact-item">
                        <code className="redact-value">{m.value}</code>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <button
                className="ocr-run-btn"
                style={{ marginTop: 12, background: 'var(--danger-bg)', borderColor: 'var(--danger-hover)', color: 'var(--danger-color)' }}
                onClick={() => onRedactAll(matches)}
              >
                🛡️ Redact All ({matches.length} items)
              </button>
            </>
          )}

          <button className="ocr-run-btn" style={{ marginTop: 8 }} onClick={runScan}>
            🔄 Re-scan
          </button>
        </div>
      )}
    </div>
  );
}

export default RedactPanel;

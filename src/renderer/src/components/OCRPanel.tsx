import React, { useState, useCallback } from 'react';
import '../styles/editor.css';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { useAuthStore } from '../store/authStore';
import { FeatureGate } from './FeatureGate';

interface OCRPanelProps {
  imageUri: string;
  onClose: () => void;
}

const OCRPanel: React.FC<OCRPanelProps> = ({ imageUri, onClose }) => {
  return (
    <FeatureGate
      feature="smart.ocr"
      fallback={<LockedOCR onClose={onClose} />}
    >
      <OCRPanelInner imageUri={imageUri} onClose={onClose} />
    </FeatureGate>
  );
};

// ── Locked state shown when daily limit is hit ───────────────────────────────
function LockedOCR({ onClose }: { onClose: () => void }) {
  const gate = useFeatureGate('smart.ocr');
  return (
    <div className="ocr-panel">
      <div className="ocr-header">
        <span>📝 OCR Text Extraction</span>
        <button className="icon-button-sm" onClick={onClose}>✕</button>
      </div>
      <div className="ocr-empty">
        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>
          {gate.reason === 'limit_reached'
            ? `Daily limit reached (${gate.dailyLimit}/day)`
            : 'OCR requires SnapForge Pro'}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          {gate.reason === 'limit_reached'
            ? 'Upgrade to Pro for unlimited OCR extractions.'
            : 'Extract text from any screenshot with Pro.'}
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

// ── Inner panel — only rendered when access is allowed ───────────────────────
function OCRPanelInner({ imageUri, onClose }: OCRPanelProps) {
  const { incrementUsage } = useAuthStore();
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runOCR = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setText(null);

    try {
      // Dynamic import to avoid loading tesseract.js until needed
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(imageUri, 'eng', {
        logger: (_m: any) => { /* could surface progress here */ }
      });
      setText(data.text.trim() || '(No text detected)');
      // Track usage — fires after a successful extraction
      incrementUsage('smart.ocr');
    } catch (err: any) {
      console.error('[OCR] Failed:', err);
      setError('OCR failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [imageUri, incrementUsage]);

  const handleCopy = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="ocr-panel">
      <div className="ocr-header">
        <span>📝 OCR Text Extraction</span>
        <button className="icon-button-sm" onClick={onClose}>✕</button>
      </div>

      {!text && !isLoading && !error && (
        <div className="ocr-empty">
          <p>Extract text from your screenshot using OCR.</p>
          <button className="ocr-run-btn" onClick={runOCR}>
            🔍 Extract Text
          </button>
        </div>
      )}

      {isLoading && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <p>Extracting text…</p>
          <p className="ocr-hint">First run downloads the language model (~4MB)</p>
        </div>
      )}

      {error && (
        <div className="ocr-error">
          <p>{error}</p>
          <button className="ocr-run-btn" onClick={runOCR}>
            Retry
          </button>
        </div>
      )}

      {text && (
        <div className="ocr-result">
          <pre className="ocr-text">{text}</pre>
          <button className="ocr-copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy Text'}
          </button>
        </div>
      )}
    </div>
  );
}

export default OCRPanel;

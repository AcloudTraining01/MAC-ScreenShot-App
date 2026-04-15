import React, { useState, useCallback } from 'react';
import '../styles/editor.css';

interface OCRPanelProps {
  imageUri: string;
  onClose: () => void;
}

const OCRPanel: React.FC<OCRPanelProps> = ({ imageUri, onClose }) => {
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
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            // Could show progress here
          }
        }
      });
      setText(data.text.trim() || '(No text detected)');
    } catch (err: any) {
      console.error('[OCR] Failed:', err);
      setError('OCR failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [imageUri]);

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
};

export default OCRPanel;

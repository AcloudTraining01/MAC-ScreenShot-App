import React, { useEffect, useState } from 'react';

interface PreviewWindowProps {
  onClose?: () => void;
}

const PreviewWindow: React.FC<PreviewWindowProps> = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'copied' | 'saved'>('idle');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.api.closePreview();
    };
    window.addEventListener('keydown', handleKeyDown);

    const unsubscribe = window.api.onInitPreview((uri) => {
      setImageUri(uri);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, []);

  const handleCopy = () => {
    if (!imageUri) return;
    setStatus('copied');
    window.api.copyScreenshot(imageUri);
  };

  const handleSave = () => {
    if (!imageUri) return;
    setStatus('saved');
    window.api.downloadScreenshot(imageUri);
  };

  const handleEdit = () => {
    if (!imageUri) return;
    window.api.openEditor(imageUri);
  };

  if (!imageUri) {
    return (
      <div className="preview-container loading">
        <div className="loading-text">Loading preview…</div>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-title">📸 Screenshot Captured</span>
        <button
          className="icon-button"
          onClick={() => window.api.closePreview()}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      <div className="preview-content">
        <img src={imageUri} draggable={false} alt="Screenshot Preview" />
      </div>

      <div className="preview-footer">
        <button className="danger" onClick={() => window.api.closePreview()}>
          Discard
        </button>
        <button className="secondary" onClick={handleEdit}>
          🎨 Edit
        </button>
        <button onClick={handleSave} disabled={status !== 'idle'}>
          {status === 'saved' ? '✓ Saved!' : '💾 Save As…'}
        </button>
        <button className="primary" onClick={handleCopy} disabled={status !== 'idle'}>
          {status === 'copied' ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>
    </div>
  );
};

export default PreviewWindow;

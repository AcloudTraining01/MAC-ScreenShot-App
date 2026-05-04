import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/beautifier.css';

interface BeautifierProps {
  imageUri: string;
  onApply: (beautifiedUri: string) => void;
  onClose: () => void;
}

interface Preset {
  name: string;
  emoji: string;
  bg: string;
  padding: number;
  borderRadius: number;
  shadow: boolean;
  shadowIntensity: number;
}

const PRESETS: Preset[] = [
  {
    name: 'Ocean',
    emoji: '🌊',
    bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 52,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.4,
  },
  {
    name: 'Sunset',
    emoji: '🌅',
    bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    padding: 52,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.35,
  },
  {
    name: 'Forest',
    emoji: '🌿',
    bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    padding: 52,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.35,
  },
  {
    name: 'Midnight',
    emoji: '🌌',
    bg: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d1b69 100%)',
    padding: 56,
    borderRadius: 16,
    shadow: true,
    shadowIntensity: 0.6,
  },
  {
    name: 'Aurora',
    emoji: '🔮',
    bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 50%, #a6c1ee 100%)',
    padding: 52,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.3,
  },
  {
    name: 'Ember',
    emoji: '🔥',
    bg: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    padding: 52,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.3,
  },
  {
    name: 'macOS',
    emoji: '🍎',
    bg: 'linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)',
    padding: 44,
    borderRadius: 12,
    shadow: true,
    shadowIntensity: 0.2,
  },
  {
    name: 'Minimal',
    emoji: '⬜',
    bg: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    padding: 36,
    borderRadius: 10,
    shadow: true,
    shadowIntensity: 0.15,
  },
  {
    name: 'Deep Space',
    emoji: '🚀',
    bg: 'linear-gradient(135deg, #020024 0%, #090979 50%, #00d4ff 100%)',
    padding: 60,
    borderRadius: 18,
    shadow: true,
    shadowIntensity: 0.7,
  },
  {
    name: 'Rose',
    emoji: '🌸',
    bg: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    padding: 48,
    borderRadius: 14,
    shadow: true,
    shadowIntensity: 0.25,
  },
];

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cssGradient: string
): void {
  const colorMatches = cssGradient.match(/#[0-9a-f]{6}/gi);
  if (!colorMatches || colorMatches.length < 2) {
    ctx.fillStyle = '#667eea';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  colorMatches.forEach((color, i) => {
    gradient.addColorStop(i / (colorMatches.length - 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderBeautified(
  img: HTMLImageElement,
  preset: Preset,
  customPadding: number,
  customRadius: number,
  shadowEnabled: boolean
): string {
  const canvas = document.createElement('canvas');
  const padding = customPadding;
  canvas.width = img.naturalWidth + padding * 2;
  canvas.height = img.naturalHeight + padding * 2;

  const ctx = canvas.getContext('2d')!;

  // Background
  drawGradientBackground(ctx, canvas.width, canvas.height, preset.bg);

  // macOS-style window dots (decorative) for some presets
  if (padding >= 44) {
    const dotY = padding * 0.38;
    const dotX = padding * 0.45;
    const dotR = Math.max(4, padding * 0.065);
    const dotGap = dotR * 2.8;
    [['#ff5f57'], ['#ffbd2e'], ['#28c940']].forEach(([color], i) => {
      ctx.beginPath();
      ctx.arc(dotX + i * dotGap, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // Shadow
  if (shadowEnabled) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${preset.shadowIntensity})`;
    ctx.shadowBlur = Math.round(padding * 0.7);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(padding * 0.18);
    roundedRectPath(ctx, padding, padding, img.naturalWidth, img.naturalHeight, customRadius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  // Clipped screenshot
  ctx.save();
  roundedRectPath(ctx, padding, padding, img.naturalWidth, img.naturalHeight, customRadius);
  ctx.clip();
  ctx.drawImage(img, padding, padding);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

const Beautifier: React.FC<BeautifierProps> = ({ imageUri, onApply, onClose }) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customPadding, setCustomPadding] = useState(PRESETS[0].padding);
  const [customRadius, setCustomRadius] = useState(PRESETS[0].borderRadius);
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const renderPreview = useCallback(
    (preset: Preset, padding: number, radius: number, shadow: boolean) => {
      if (!imgRef.current) return;
      const img = imgRef.current;
      setIsRendering(true);
      requestAnimationFrame(() => {
        const uri = renderBeautified(img, preset, padding, radius, shadow);
        setPreviewUri(uri);

        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = img.naturalWidth + padding * 2;
          fullCanvas.height = img.naturalHeight + padding * 2;
          const tmpImg = new Image();
          tmpImg.onload = () => {
            const pCtx = previewCanvas.getContext('2d');
            if (pCtx) {
              const maxW = 300;
              const maxH = 200;
              const scale = Math.min(maxW / tmpImg.naturalWidth, maxH / tmpImg.naturalHeight);
              previewCanvas.width = Math.round(tmpImg.naturalWidth * scale);
              previewCanvas.height = Math.round(tmpImg.naturalHeight * scale);
              pCtx.drawImage(tmpImg, 0, 0, previewCanvas.width, previewCanvas.height);
            }
            setIsRendering(false);
          };
          tmpImg.src = uri;
        } else {
          setIsRendering(false);
        }
      });
    },
    []
  );

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      renderPreview(PRESETS[0], PRESETS[0].padding, PRESETS[0].borderRadius, true);
    };
    img.src = imageUri;
  }, [imageUri]);

  // Re-render on any change
  useEffect(() => {
    if (!imgRef.current) return;
    renderPreview(PRESETS[selectedPreset], customPadding, customRadius, shadowEnabled);
  }, [selectedPreset, customPadding, customRadius, shadowEnabled]);

  const handlePresetSelect = (i: number) => {
    setSelectedPreset(i);
    setCustomPadding(PRESETS[i].padding);
    setCustomRadius(PRESETS[i].borderRadius);
  };

  const handleApply = () => {
    if (previewUri) onApply(previewUri);
  };

  return (
    <div className="beautifier-root">
      {/* Header */}
      <div className="beautifier-header">
        <span className="beautifier-title">✨ Beautifier</span>
        <button className="icon-button-sm" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Live preview */}
      <div className="beautifier-preview-wrap">
        {isRendering && <div className="beautifier-preview-spinner" />}
        <canvas
          ref={previewCanvasRef}
          className={`beautifier-preview-canvas ${isRendering ? 'rendering' : ''}`}
        />
      </div>

      {/* Preset grid */}
      <div className="beautifier-presets-grid">
        {PRESETS.map((preset, i) => (
          <button
            key={preset.name}
            className={`beautifier-preset-btn ${selectedPreset === i ? 'selected' : ''}`}
            onClick={() => handlePresetSelect(i)}
            title={preset.name}
          >
            <div className="beautifier-preset-swatch" style={{ background: preset.bg }} />
            <span className="beautifier-preset-label">{preset.emoji} {preset.name}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="beautifier-controls">
        <div className="beautifier-control-row">
          <span className="beautifier-control-label">Padding</span>
          <input
            type="range"
            min={0}
            max={120}
            value={customPadding}
            onChange={(e) => setCustomPadding(Number(e.target.value))}
            className="beautifier-slider"
          />
          <span className="beautifier-control-value">{customPadding}px</span>
        </div>

        <div className="beautifier-control-row">
          <span className="beautifier-control-label">Radius</span>
          <input
            type="range"
            min={0}
            max={36}
            value={customRadius}
            onChange={(e) => setCustomRadius(Number(e.target.value))}
            className="beautifier-slider"
          />
          <span className="beautifier-control-value">{customRadius}px</span>
        </div>

        <div className="beautifier-control-row">
          <span className="beautifier-control-label">Shadow</span>
          <label className="beautifier-toggle">
            <input
              type="checkbox"
              checked={shadowEnabled}
              onChange={(e) => setShadowEnabled(e.target.checked)}
            />
            <span className="beautifier-toggle-track" />
          </label>
        </div>
      </div>

      {/* Apply */}
      <button className="beautifier-apply-btn" onClick={handleApply} disabled={isRendering}>
        {isRendering ? 'Rendering…' : '✨ Apply & Edit'}
      </button>
    </div>
  );
};

export default Beautifier;

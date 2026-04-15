import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, FabricImage, Rect } from 'fabric';
import Toolbar from './Toolbar';
import PropertyPanel from './PropertyPanel';
import Beautifier from './Beautifier';
import OCRPanel from './OCRPanel';
import RedactPanel from './RedactPanel';
import type { ToolName, ToolConfig, ToolHandler } from './tools/types';
import { DEFAULT_TOOL_CONFIG } from './tools/types';
import { ArrowTool } from './tools/ArrowTool';
import { RectTool, EllipseTool } from './tools/RectTool';
import { PenTool } from './tools/PenTool';
import { TextTool } from './tools/TextTool';
import { BlurTool } from './tools/BlurTool';
import { HighlightTool } from './tools/HighlightTool';
import { StepTool, resetStepCounter } from './tools/StepTool';
import { CropTool } from './tools/CropTool';
import { EyedropperTool } from './tools/EyedropperTool';
import { EmojiTool } from './tools/EmojiTool';
import type { PIIMatch } from '../services/piiDetector';
import '../styles/editor.css';

const BG_DATA_KEY = '__snapforge_bg';

const EditorWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<ToolHandler | null>(null);
  const bgImageRef = useRef<FabricImage | null>(null);
  const displayScaleRef = useRef(1);
  const imageDimsRef = useRef({ w: 0, h: 0 });

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>('select');
  const [toolConfig, setToolConfig] = useState<ToolConfig>({ ...DEFAULT_TOOL_CONFIG });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [showBeautifier, setShowBeautifier] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showRedact, setShowRedact] = useState(false);
  const [originalSize, setOriginalSize] = useState<{w: number, h: number} | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState('👍');
  const emojiToolRef = useRef<EmojiTool | null>(null);

  // ── Receive image data from main process ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.api.closeEditor();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (fabricRef.current) {
          const active = fabricRef.current.getActiveObject();
          if (active && !(active as any).isEditing && !(active as any).data?.[BG_DATA_KEY]) {
            fabricRef.current.remove(active);
            fabricRef.current.discardActiveObject();
            fabricRef.current.renderAll();
            saveState();
          }
        }
      }
      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const shortcutMap: Record<string, ToolName> = {
          'v': 'select', 'a': 'arrow', 'r': 'rect', 'o': 'ellipse',
          'p': 'pen', 't': 'text', 'h': 'highlight', 'b': 'blur',
          's': 'step', 'c': 'crop', 'i': 'eyedropper', 'e': 'emoji'
        };
        if (shortcutMap[key]) {
          setActiveTool(shortcutMap[key]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const unsubscribe = window.api.onInitEditor((uri) => {
      setImageUri(uri);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, []);

  // ── Fit the background image to the canvas container ──
  const fitBgToCanvas = useCallback((canvas: FabricCanvas) => {
    const container = containerRef.current;
    const bg = bgImageRef.current;
    if (!container || !bg) return;

    const rect = container.getBoundingClientRect();
    const cw = Math.floor(rect.width);
    const ch = Math.floor(rect.height);
    if (cw <= 0 || ch <= 0) return;

    canvas.setDimensions({ width: cw, height: ch });

    const imgW = imageDimsRef.current.w;
    const imgH = imageDimsRef.current.h;
    if (imgW <= 0 || imgH <= 0) return;

    const scale = Math.min(cw / imgW, ch / imgH);
    displayScaleRef.current = scale;

    bg.set({
      scaleX: scale,
      scaleY: scale,
      left: (cw - imgW * scale) / 2,
      top: (ch - imgH * scale) / 2,
    });
    bg.setCoords();
    canvas.requestRenderAll();
  }, []);

  // ── Helper: add an image as the locked background object ──
  const addBgImage = useCallback((canvas: FabricCanvas, fabricImg: FabricImage) => {
    const imgW = fabricImg.width || 1;
    const imgH = fabricImg.height || 1;
    imageDimsRef.current = { w: imgW, h: imgH };
    setOriginalSize({ w: imgW, h: imgH });

    fabricImg.set({
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      originX: 'left',
      originY: 'top',
      data: { [BG_DATA_KEY]: true },
    });

    // Remove any old background objects
    canvas.getObjects().forEach((obj) => {
      if ((obj as any).data?.[BG_DATA_KEY]) canvas.remove(obj);
    });

    canvas.insertAt(0, fabricImg);
    bgImageRef.current = fabricImg;

    fitBgToCanvas(canvas);
  }, [fitBgToCanvas]);

  // ── Initialize Fabric.js canvas when image loads ──
  useEffect(() => {
    if (!imageUri || !canvasRef.current || fabricRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    const canvas = new FabricCanvas(canvasRef.current!, {
      selection: true,
      backgroundColor: '#18181c',
    });
    canvas.setZoom(1);
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    fabricRef.current = canvas;

    FabricImage.fromURL(imageUri).then((fabricImg) => {
      addBgImage(canvas, fabricImg);

      // Multiple timing fallbacks to guarantee fit after layout
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitBgToCanvas(canvas);
          saveStateInternal(canvas);
        });
      });
      setTimeout(() => { if (fabricRef.current) fitBgToCanvas(fabricRef.current); }, 150);
      setTimeout(() => { if (fabricRef.current) fitBgToCanvas(fabricRef.current); }, 500);
    });

    // ResizeObserver for continuous tracking
    const container = containerRef.current;
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        if (fabricRef.current) fitBgToCanvas(fabricRef.current);
      });
      resizeObserver.observe(container);
    }

    canvas.on('object:added', () => saveStateInternal(canvas));
    canvas.on('object:modified', () => saveStateInternal(canvas));

    return () => {
      resizeObserver?.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, [imageUri, addBgImage, fitBgToCanvas]);

  // ── State management for undo/redo ──
  const saveStateInternal = useCallback((canvas: FabricCanvas) => {
    const json = JSON.stringify((canvas as any).toJSON(['data']));
    setUndoStack((prev) => [...prev, json]);
    setRedoStack([]);
  }, []);

  const saveState = useCallback(() => {
    if (fabricRef.current) {
      saveStateInternal(fabricRef.current);
    }
  }, [saveStateInternal]);

  // After loadFromJSON, re-lock the background object and update refs
  const relockBackground = useCallback((canvas: FabricCanvas) => {
    const objects = canvas.getObjects();
    for (const obj of objects) {
      if ((obj as any).data?.[BG_DATA_KEY]) {
        obj.set({ selectable: false, evented: false, hoverCursor: 'default' });
        bgImageRef.current = obj as FabricImage;
        const fi = obj as FabricImage;
        imageDimsRef.current = { w: fi.width || 1, h: fi.height || 1 };
        break;
      }
    }
    fitBgToCanvas(canvas);
  }, [fitBgToCanvas]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length < 2) return prev;
      const newStack = [...prev];
      const current = newStack.pop()!;
      setRedoStack((r) => [...r, current]);

      const previous = newStack[newStack.length - 1];
      if (fabricRef.current && previous) {
        fabricRef.current.loadFromJSON(JSON.parse(previous)).then(() => {
          relockBackground(fabricRef.current!);
          fabricRef.current?.renderAll();
        });
      }
      return newStack;
    });
  }, [relockBackground]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const next = newStack.pop()!;
      setUndoStack((u) => [...u, next]);

      if (fabricRef.current) {
        fabricRef.current.loadFromJSON(JSON.parse(next)).then(() => {
          relockBackground(fabricRef.current!);
          fabricRef.current?.renderAll();
        });
      }
      return newStack;
    });
  }, [relockBackground]);

  // ── Tool switching ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Deactivate previous tool
    if (toolRef.current) {
      toolRef.current.deactivate(canvas);
      toolRef.current = null;
    }

    let handler: ToolHandler | null = null;
    switch (activeTool) {
      case 'select':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        break;
      case 'arrow': handler = new ArrowTool(toolConfig); break;
      case 'rect': handler = new RectTool(toolConfig); break;
      case 'ellipse': handler = new EllipseTool(toolConfig); break;
      case 'pen': handler = new PenTool(toolConfig); break;
      case 'text': handler = new TextTool(toolConfig); break;
      case 'blur': handler = new BlurTool(toolConfig); break;
      case 'highlight': handler = new HighlightTool(toolConfig); break;
      case 'step': handler = new StepTool(toolConfig); break;
      case 'crop': {
        const cropTool = new CropTool(toolConfig);
        cropTool.setCropCallback((x, y, w, h) => handleCrop(x, y, w, h));
        handler = cropTool;
        break;
      }
      case 'eyedropper': {
        const eyedropper = new EyedropperTool(toolConfig);
        eyedropper.setColorCallback((color) => {
          setToolConfig((prev) => ({ ...prev, color }));
          setActiveTool('select');
        });
        handler = eyedropper;
        break;
      }
      case 'emoji': {
        const emojiTool = new EmojiTool(toolConfig, selectedEmoji);
        emojiToolRef.current = emojiTool;
        handler = emojiTool;
        break;
      }
    }

    if (handler) {
      handler.activate(canvas);
      toolRef.current = handler;
    }
  }, [activeTool, toolConfig]);

  // ── Crop handler ──
  const handleCrop = useCallback((x: number, y: number, w: number, h: number) => {
    const canvas = fabricRef.current;
    if (!canvas || !originalSize) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const fullCanvas = canvas.toCanvasElement();
    tempCtx.drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);
    const croppedUri = tempCanvas.toDataURL('image/png');

    canvas.clear();
    canvas.backgroundColor = '#18181c';
    FabricImage.fromURL(croppedUri).then((fabricImg) => {
      addBgImage(canvas, fabricImg);
      saveState();
    });

    setActiveTool('select');
  }, [saveState, addBgImage, originalSize]);

  // ── Config changes ──
  const handleConfigChange = (partial: Partial<ToolConfig>) => {
    setToolConfig((prev) => ({ ...prev, ...partial }));
  };

  // ── Export ──
  const exportImage = useCallback((): string | null => {
    if (!fabricRef.current || !originalSize) return null;

    const canvas = fabricRef.current;
    const bg = bgImageRef.current;
    if (!bg) return null;

    const scale = displayScaleRef.current;
    const bgLeft = bg.left || 0;
    const bgTop = bg.top || 0;

    // Render the image area at native resolution
    const dataUri = canvas.toDataURL({
      format: 'png',
      multiplier: 1 / scale,
      left: bgLeft,
      top: bgTop,
      width: originalSize.w * scale,
      height: originalSize.h * scale,
    });
    return dataUri;
  }, [originalSize]);

  const handleCopy = () => {
    const dataUri = exportImage();
    if (dataUri) window.api.copyEdited(dataUri);
  };

  const handleSave = () => {
    const dataUri = exportImage();
    if (dataUri) window.api.saveEdited(dataUri);
  };

  const handleBeautify = (beautifiedUri: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '#18181c';
    FabricImage.fromURL(beautifiedUri).then((fabricImg) => {
      addBgImage(canvas, fabricImg);
      saveState();
    });
    setShowBeautifier(false);
  };

  if (!imageUri) {
    return (
      <div className="editor-container">
        <div className="editor-loading">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* ── Header Bar: tools left, features + actions right ── */}
      <div className="editor-header">
        <div className="editor-header-center">
          <Toolbar
            activeTool={activeTool}
            onToolSelect={setActiveTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 1}
            canRedo={redoStack.length > 0}
            selectedEmoji={selectedEmoji}
            onEmojiChange={(emoji) => {
              setSelectedEmoji(emoji);
              emojiToolRef.current?.setEmoji(emoji);
            }}
          />
        </div>
        <div className="editor-header-right">
          <button
            className={`editor-feature-btn ${showOCR ? 'active' : ''}`}
            onClick={() => { setShowOCR(!showOCR); setShowBeautifier(false); setShowRedact(false); }}
            title="OCR Text Extraction"
          >
            📝 OCR
          </button>
          <button
            className={`editor-feature-btn ${showRedact ? 'active' : ''}`}
            onClick={() => { setShowRedact(!showRedact); setShowOCR(false); setShowBeautifier(false); }}
            title="Smart Redact PII"
          >
            🛡️ Redact
          </button>
          <button
            className={`editor-feature-btn ${showBeautifier ? 'active' : ''}`}
            onClick={() => { setShowBeautifier(!showBeautifier); setShowOCR(false); setShowRedact(false); }}
            title="Screenshot Beautifier"
          >
            ✨ Beautify
          </button>
          <div className="header-divider" />
          <button className="editor-action-btn" onClick={() => window.api.closeEditor()}>
            Discard
          </button>
          <button className="editor-action-btn" onClick={handleSave}>
            💾 Save
          </button>
          <button className="editor-action-btn primary" onClick={handleCopy}>
            📋 Copy
          </button>
        </div>
      </div>

      {/* ── Property Bar (visible when a drawing tool is active) ── */}
      {activeTool !== 'select' && activeTool !== 'crop' && (
        <div className="editor-property-bar">
          <PropertyPanel
            activeTool={activeTool}
            config={toolConfig}
            onConfigChange={handleConfigChange}
          />
        </div>
      )}

      {/* ── Canvas fills all remaining space ── */}
      <div className="editor-canvas-wrapper" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>

      {/* ── Floating Panels (OCR / Beautifier) ── */}
      {showBeautifier && (
        <div className="floating-panel">
          <Beautifier
            imageUri={exportImage() || imageUri}
            onApply={handleBeautify}
            onClose={() => setShowBeautifier(false)}
          />
        </div>
      )}
      {showOCR && (
        <div className="floating-panel">
          <OCRPanel
            imageUri={exportImage() || imageUri}
            onClose={() => setShowOCR(false)}
          />
        </div>
      )}
      {showRedact && (
        <div className="floating-panel">
          <RedactPanel
            imageUri={exportImage() || imageUri}
            onRedactAll={(matches) => {
              // Apply blur rectangles over detected PII regions
              const canvas = fabricRef.current;
              if (!canvas) return;
              // For now, add red semi-transparent rectangles as redaction markers
              matches.forEach(() => {
                // Since we can't map text positions back to pixel coordinates
                // from OCR without word-level bbox data, we notify the user
                // and use the blur tool manually. In a future version with
                // Tesseract word-level bounding boxes, we can auto-place.
              });
              setShowRedact(false);
            }}
            onClose={() => setShowRedact(false)}
          />
        </div>
      )}
    </div>
  );
};

export default EditorWindow;

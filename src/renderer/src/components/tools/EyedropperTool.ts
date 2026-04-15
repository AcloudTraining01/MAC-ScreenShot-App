import type { Canvas as FabricCanvas } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

/**
 * Eyedropper / Color Picker Tool with a live Pixel Zoom Loupe.
 * A magnifying glass follows the cursor, showing a 11x11 pixel grid
 * at 10x zoom so users can see pixel-perfect color selection.
 */
export class EyedropperTool implements ToolHandler {
  name = 'eyedropper';
  icon = '💧';
  cursor = 'none'; // We draw our own loupe cursor

  private config: ToolConfig;
  private onColorPicked: ((color: string) => void) | null = null;
  private clickHandler: ((opt: any) => void) | null = null;
  private moveHandler: ((opt: any) => void) | null = null;

  // Loupe DOM element
  private loupe: HTMLDivElement | null = null;
  private loupeCanvas: HTMLCanvasElement | null = null;
  private loupeCtx: CanvasRenderingContext2D | null = null;
  private colorInfo: HTMLDivElement | null = null;

  private readonly LOUPE_SIZE = 160;     // px diameter of loupe
  private readonly ZOOM_RADIUS = 5;      // pixels to sample in each direction (11x11 grid)
  private readonly PIXEL_SIZE = 14;      // rendered size of each zoomed pixel

  constructor(config: ToolConfig) {
    this.config = config;
  }

  setColorCallback(cb: (color: string) => void): void {
    this.onColorPicked = cb;
  }

  private createLoupe(container: HTMLElement): void {
    // Container div
    this.loupe = document.createElement('div');
    Object.assign(this.loupe.style, {
      position: 'fixed',
      width: `${this.LOUPE_SIZE}px`,
      height: `${this.LOUPE_SIZE}px`,
      borderRadius: '50%',
      border: '2.5px solid rgba(255,255,255,0.9)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '9999',
      transition: 'opacity 0.1s ease',
      opacity: '0',
    });

    // Canvas inside the loupe
    this.loupeCanvas = document.createElement('canvas');
    const gridDim = (this.ZOOM_RADIUS * 2 + 1) * this.PIXEL_SIZE;
    this.loupeCanvas.width = gridDim;
    this.loupeCanvas.height = gridDim;
    Object.assign(this.loupeCanvas.style, {
      width: `${this.LOUPE_SIZE}px`,
      height: `${this.LOUPE_SIZE}px`,
      imageRendering: 'pixelated',
    });
    this.loupeCtx = this.loupeCanvas.getContext('2d', { willReadFrequently: true });

    // Cross-hair overlay
    const crosshair = document.createElement('div');
    Object.assign(crosshair.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    });
    crosshair.innerHTML = `
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.7);transform:translateX(-50%)"></div>
      <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,0.7);transform:translateY(-50%)"></div>
    `;

    // Color info strip at the bottom
    this.colorInfo = document.createElement('div');
    Object.assign(this.colorInfo.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      height: '28px',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      color: '#fff',
      letterSpacing: '0.05em',
      fontWeight: '600',
    });
    this.colorInfo.textContent = '#------';

    this.loupe.appendChild(this.loupeCanvas);
    this.loupe.appendChild(crosshair);
    this.loupe.appendChild(this.colorInfo);
    document.body.appendChild(this.loupe);
  }

  private updateLoupe(
    canvasEl: HTMLCanvasElement,
    screenX: number,
    screenY: number,
    sceneX: number,
    sceneY: number
  ): void {
    if (!this.loupe || !this.loupeCanvas || !this.loupeCtx) return;

    const radius = this.ZOOM_RADIUS;
    const pxSize = this.PIXEL_SIZE;
    const ctx = this.loupeCtx;
    const srcCtx = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return;

    const gridDim = (radius * 2 + 1) * pxSize;
    ctx.clearRect(0, 0, gridDim, gridDim);

    // Draw each pixel as a zoomed square
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = Math.round(sceneX) + dx;
        const py = Math.round(sceneY) + dy;
        let color = 'transparent';
        if (px >= 0 && py >= 0 && px < canvasEl.width && py < canvasEl.height) {
          const pData = srcCtx.getImageData(px, py, 1, 1).data;
          color = `rgb(${pData[0]}, ${pData[1]}, ${pData[2]})`;
        }
        const gx = (dx + radius) * pxSize;
        const gy = (dy + radius) * pxSize;
        ctx.fillStyle = color;
        ctx.fillRect(gx, gy, pxSize, pxSize);

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(gx, gy, pxSize, pxSize);
      }
    }

    // Get center pixel hex for color info
    const centerData = srcCtx.getImageData(Math.round(sceneX), Math.round(sceneY), 1, 1).data;
    const hex = '#' +
      centerData[0].toString(16).padStart(2, '0') +
      centerData[1].toString(16).padStart(2, '0') +
      centerData[2].toString(16).padStart(2, '0');

    if (this.colorInfo) {
      this.colorInfo.textContent = hex.toUpperCase();
      this.colorInfo.style.backgroundColor = `rgba(${centerData[0]},${centerData[1]},${centerData[2]},0.3)`;
    }

    // Position the loupe offset from cursor so it doesn't block the target
    const offset = this.LOUPE_SIZE / 2 + 20;
    let lx = screenX + offset;
    let ly = screenY - offset;
    if (lx + this.LOUPE_SIZE > window.innerWidth) lx = screenX - offset - this.LOUPE_SIZE;
    if (ly < 0) ly = screenY + offset;

    this.loupe.style.left = `${lx}px`;
    this.loupe.style.top = `${ly}px`;
    this.loupe.style.opacity = '1';
  }

  private removeLoupe(): void {
    if (this.loupe) {
      this.loupe.remove();
      this.loupe = null;
      this.loupeCanvas = null;
      this.loupeCtx = null;
      this.colorInfo = null;
    }
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'none';
    canvas.hoverCursor = 'none';
    canvas.discardActiveObject();
    canvas.renderAll();

    this.createLoupe(document.body);

    this.moveHandler = (opt: any) => {
      const pointer = canvas.getScenePoint(opt.e);
      const canvasEl = canvas.getElement();
      this.updateLoupe(
        canvasEl,
        opt.e.clientX,
        opt.e.clientY,
        pointer.x,
        pointer.y
      );
    };

    this.clickHandler = (opt: any) => {
      const pointer = canvas.getScenePoint(opt.e);
      const x = Math.round(pointer.x);
      const y = Math.round(pointer.y);

      const canvasEl = canvas.getElement();
      const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' +
        pixel[0].toString(16).padStart(2, '0') +
        pixel[1].toString(16).padStart(2, '0') +
        pixel[2].toString(16).padStart(2, '0');

      if (this.onColorPicked) {
        this.onColorPicked(hex);
      }
    };

    canvas.on('mouse:move', this.moveHandler);
    canvas.on('mouse:down', this.clickHandler);
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    if (this.moveHandler) {
      canvas.off('mouse:move', this.moveHandler);
      this.moveHandler = null;
    }
    if (this.clickHandler) {
      canvas.off('mouse:down', this.clickHandler);
      this.clickHandler = null;
    }

    this.removeLoupe();
  }
}

import { Canvas as FabricCanvas, Rect } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class CropTool implements ToolHandler {
  name = 'crop';
  icon = '✂';
  cursor = 'crosshair';
  private config: ToolConfig;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private cropRect: Rect | null = null;
  private overlay: Rect | null = null;
  private cropCallback: ((x: number, y: number, w: number, h: number) => void) | null = null;

  private onMouseDown: any;
  private onMouseMove: any;
  private onMouseUp: any;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  setCropCallback(cb: (x: number, y: number, w: number, h: number) => void): void {
    this.cropCallback = cb;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = this.cursor;
    canvas.hoverCursor = this.cursor;

    // Dim the whole canvas
    this.overlay = new Rect({
      left: 0,
      top: 0,
      width: canvas.width || 0,
      height: canvas.height || 0,
      fill: 'rgba(0, 0, 0, 0.5)',
      selectable: false,
      evented: false
    });
    canvas.add(this.overlay);

    this.onMouseDown = (opt: any) => {
      const pointer = canvas.getScenePoint(opt.e);
      this.isDrawing = true;
      this.startX = pointer.x;
      this.startY = pointer.y;

      this.cropRect = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: '#4db8ff',
        strokeWidth: 2,
        strokeDashArray: [6, 3],
        selectable: false,
        evented: false
      });
      canvas.add(this.cropRect);
    };

    this.onMouseMove = (opt: any) => {
      if (!this.isDrawing || !this.cropRect) return;
      const pointer = canvas.getScenePoint(opt.e);
      const left = Math.min(this.startX, pointer.x);
      const top = Math.min(this.startY, pointer.y);
      const width = Math.abs(pointer.x - this.startX);
      const height = Math.abs(pointer.y - this.startY);
      this.cropRect.set({ left, top, width, height });
      canvas.renderAll();
    };

    this.onMouseUp = () => {
      this.isDrawing = false;
      if (this.cropRect && this.cropCallback) {
        const x = this.cropRect.left || 0;
        const y = this.cropRect.top || 0;
        const w = this.cropRect.width || 0;
        const h = this.cropRect.height || 0;
        if (w > 10 && h > 10) {
          this.cropCallback(x, y, w, h);
        }
      }
      // Clean up visual indicators
      if (this.cropRect) canvas.remove(this.cropRect);
      if (this.overlay) canvas.remove(this.overlay);
      this.cropRect = null;
      this.overlay = null;
      canvas.renderAll();
    };

    canvas.on('mouse:down', this.onMouseDown);
    canvas.on('mouse:move', this.onMouseMove);
    canvas.on('mouse:up', this.onMouseUp);
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.off('mouse:down', this.onMouseDown);
    canvas.off('mouse:move', this.onMouseMove);
    canvas.off('mouse:up', this.onMouseUp);
    if (this.overlay) {
      // Need to handle case where canvas might not have this overlay anymore
      try {
        const c = (this as any)._lastCanvas;
        if (c) c.remove(this.overlay);
      } catch {}
    }
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

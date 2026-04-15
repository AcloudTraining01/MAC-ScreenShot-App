import { Canvas as FabricCanvas, Rect } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class BlurTool implements ToolHandler {
  name = 'blur';
  icon = '▦';
  cursor = 'crosshair';
  private config: ToolConfig;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private shape: Rect | null = null;

  private onMouseDown: any;
  private onMouseMove: any;
  private onMouseUp: any;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = this.cursor;
    canvas.hoverCursor = this.cursor;

    this.onMouseDown = (opt: any) => {
      const pointer = canvas.getScenePoint(opt.e);
      this.isDrawing = true;
      this.startX = pointer.x;
      this.startY = pointer.y;

      // Create a pixelation overlay using a crosshatch pattern
      this.shape = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'rgba(128, 128, 128, 0.7)',
        stroke: 'rgba(100, 100, 100, 0.4)',
        strokeWidth: 1,
        rx: 2,
        ry: 2,
        selectable: false,
        evented: false
      });
      canvas.add(this.shape);
    };

    this.onMouseMove = (opt: any) => {
      if (!this.isDrawing || !this.shape) return;
      const pointer = canvas.getScenePoint(opt.e);
      const left = Math.min(this.startX, pointer.x);
      const top = Math.min(this.startY, pointer.y);
      const width = Math.abs(pointer.x - this.startX);
      const height = Math.abs(pointer.y - this.startY);

      this.shape.set({ left, top, width, height });
      canvas.renderAll();
    };

    this.onMouseUp = (opt: any) => {
      if (!this.isDrawing || !this.shape) return;
      this.isDrawing = false;

      const left = this.shape.left || 0;
      const top = this.shape.top || 0;
      const width = this.shape.width || 0;
      const height = this.shape.height || 0;

      // Remove the temp shape
      canvas.remove(this.shape);

      if (width < 5 || height < 5) {
        this.shape = null;
        return;
      }

      // Get the underlying image data and pixelate it
      this.pixelateRegion(canvas, left, top, width, height);
      this.shape = null;
    };

    canvas.on('mouse:down', this.onMouseDown);
    canvas.on('mouse:move', this.onMouseMove);
    canvas.on('mouse:up', this.onMouseUp);
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.off('mouse:down', this.onMouseDown);
    canvas.off('mouse:move', this.onMouseMove);
    canvas.off('mouse:up', this.onMouseUp);
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
  }

  private pixelateRegion(
    canvas: FabricCanvas,
    x: number, y: number, w: number, h: number
  ): void {
    // Create a mosaic/pixelate effect using small colored rectangles
    const pixelSize = 10;
    const canvasEl = canvas.toCanvasElement();
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // Sample the image data at low resolution
    const rects: Rect[] = [];
    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        const sampleX = Math.min(Math.floor(x + px), canvasEl.width - 1);
        const sampleY = Math.min(Math.floor(y + py), canvasEl.height - 1);
        const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
        const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;

        const rect = new Rect({
          left: x + px,
          top: y + py,
          width: Math.min(pixelSize, w - px),
          height: Math.min(pixelSize, h - py),
          fill: color,
          selectable: false,
          evented: false,
          strokeWidth: 0
        });
        rects.push(rect);
      }
    }

    // Add all pixel rects then group them
    const { Group } = require('fabric');
    const group = new Group(rects, {
      selectable: true,
      evented: true
    });
    canvas.add(group);
    canvas.renderAll();
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

import { Canvas as FabricCanvas, Rect, Ellipse } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class RectTool implements ToolHandler {
  name = 'rect';
  icon = '▭';
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

      this.shape = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: this.config.fillEnabled ? this.config.color : 'transparent',
        stroke: this.config.color,
        strokeWidth: this.config.strokeWidth,
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

    this.onMouseUp = () => {
      if (this.shape) {
        this.shape.set({ selectable: true, evented: true });
        canvas.setActiveObject(this.shape);
      }
      this.isDrawing = false;
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

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

export class EllipseTool implements ToolHandler {
  name = 'ellipse';
  icon = '⬭';
  cursor = 'crosshair';
  private config: ToolConfig;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private shape: Ellipse | null = null;

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

      this.shape = new Ellipse({
        left: pointer.x,
        top: pointer.y,
        rx: 0,
        ry: 0,
        fill: this.config.fillEnabled ? this.config.color : 'transparent',
        stroke: this.config.color,
        strokeWidth: this.config.strokeWidth,
        selectable: false,
        evented: false
      });
      canvas.add(this.shape);
    };

    this.onMouseMove = (opt: any) => {
      if (!this.isDrawing || !this.shape) return;
      const pointer = canvas.getScenePoint(opt.e);
      const rx = Math.abs(pointer.x - this.startX) / 2;
      const ry = Math.abs(pointer.y - this.startY) / 2;
      const left = Math.min(this.startX, pointer.x);
      const top = Math.min(this.startY, pointer.y);

      this.shape.set({ left: left + rx, top: top + ry, rx, ry });
      canvas.renderAll();
    };

    this.onMouseUp = () => {
      if (this.shape) {
        this.shape.set({ selectable: true, evented: true });
        canvas.setActiveObject(this.shape);
      }
      this.isDrawing = false;
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

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

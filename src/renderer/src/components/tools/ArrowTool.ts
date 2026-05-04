import { Canvas as FabricCanvas, Line, Triangle, Group, util } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class ArrowTool implements ToolHandler {
  name = 'arrow';
  icon = '➜';
  cursor = 'crosshair';
  private config: ToolConfig;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private tempGroup: Group | null = null;

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
    };

    this.onMouseMove = (opt: any) => {
      if (!this.isDrawing) return;
      const pointer = canvas.getScenePoint(opt.e);
      if (this.tempGroup) {
        canvas.remove(this.tempGroup);
        this.tempGroup = null;
      }
      this.tempGroup = this.createArrow(
        this.startX, this.startY,
        pointer.x, pointer.y
      );
      canvas.add(this.tempGroup);
      canvas.renderAll();
    };

    this.onMouseUp = () => {
      this.isDrawing = false;
      this.tempGroup = null;
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

  private createArrow(x1: number, y1: number, x2: number, y2: number): Group {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const headLen = 15;

    const line = new Line([x1, y1, x2, y2], {
      stroke: this.config.color,
      strokeWidth: this.config.strokeWidth,
      selectable: false,
      evented: false
    });

    const triangle = new Triangle({
      left: x2,
      top: y2,
      originX: 'center',
      originY: 'center',
      angle: util.radiansToDegrees(angle) + 90,
      width: headLen,
      height: headLen,
      fill: this.config.color,
      selectable: false,
      evented: false
    });

    return new Group([line, triangle], {
      selectable: true,
      evented: true
    });
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

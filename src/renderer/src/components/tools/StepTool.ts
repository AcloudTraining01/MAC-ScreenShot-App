import { Canvas as FabricCanvas, Circle, FabricText, Group } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

let stepCounter = 1;

export function resetStepCounter(): void {
  stepCounter = 1;
}

export class StepTool implements ToolHandler {
  name = 'step';
  icon = '①';
  cursor = 'crosshair';
  private config: ToolConfig;
  private onClick: any;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = this.cursor;
    canvas.hoverCursor = this.cursor;

    this.onClick = (opt: any) => {
      if (opt.target) return;
      const pointer = canvas.getScenePoint(opt.e);

      const radius = 16;
      const circle = new Circle({
        radius,
        fill: this.config.color,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });

      const text = new FabricText(String(stepCounter), {
        fontSize: 16,
        fill: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '700',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });

      const group = new Group([circle, text], {
        left: pointer.x,
        top: pointer.y,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true
      });

      canvas.add(group);
      canvas.renderAll();
      stepCounter++;
    };

    canvas.on('mouse:down', this.onClick);
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.off('mouse:down', this.onClick);
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

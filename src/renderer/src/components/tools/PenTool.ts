import { Canvas as FabricCanvas, PencilBrush } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class PenTool implements ToolHandler {
  name = 'pen';
  icon = '✏️';
  cursor = 'crosshair';
  private config: ToolConfig;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = true;
    canvas.selection = false;
    const brush = new PencilBrush(canvas);
    brush.color = this.config.color;
    brush.width = this.config.strokeWidth;
    canvas.freeDrawingBrush = brush;
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

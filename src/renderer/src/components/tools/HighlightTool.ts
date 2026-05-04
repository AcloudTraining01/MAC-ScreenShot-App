import { Canvas as FabricCanvas, PencilBrush } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class HighlightTool implements ToolHandler {
  name = 'highlight';
  icon = '🖍️';
  cursor = 'crosshair';
  private config: ToolConfig;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = true;
    canvas.selection = false;
    const brush = new PencilBrush(canvas);
    // Semi-transparent yellow by default for highlighter effect
    const color = this.config.color || '#ffff00';
    // Convert hex to rgba with 0.35 opacity
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    brush.color = `rgba(${r}, ${g}, ${b}, 0.35)`;
    brush.width = Math.max(this.config.strokeWidth * 4, 16);
    canvas.freeDrawingBrush = brush;
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

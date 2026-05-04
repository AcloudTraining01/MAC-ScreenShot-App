import { Canvas as FabricCanvas, IText } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export class TextTool implements ToolHandler {
  name = 'text';
  icon = 'T';
  cursor = 'text';
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
      // Only add text if clicking on empty canvas (not on existing objects)
      if (opt.target) return;

      const pointer = canvas.getScenePoint(opt.e);
      const text = new IText('Type here', {
        left: pointer.x,
        top: pointer.y,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: this.config.fontSize,
        fill: this.config.color,
        fontWeight: '600',
        selectable: true,
        editable: true
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
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

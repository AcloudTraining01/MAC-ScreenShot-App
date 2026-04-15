import { Canvas as FabricCanvas, FabricText } from 'fabric';
import type { ToolHandler, ToolConfig } from './types';

export const EMOJI_LIST = [
  '👍', '👎', '❤️', '🔥', '⭐', '✅', '❌', '⚠️',
  '💡', '🎉', '🚀', '💯', '🤔', '😍', '😂', '👀',
  '💪', '🎯', '🏆', '✨', '💥', '🔑', '📌', '🛑',
];

export class EmojiTool implements ToolHandler {
  name = 'emoji';
  icon = '😀';
  cursor = 'crosshair';

  private config: ToolConfig;
  private selectedEmoji: string;
  private onClick: any;

  constructor(config: ToolConfig, emoji: string = '👍') {
    this.config = config;
    this.selectedEmoji = emoji;
  }

  setEmoji(emoji: string): void {
    this.selectedEmoji = emoji;
  }

  activate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
    canvas.discardActiveObject();
    canvas.renderAll();

    this.onClick = (opt: any) => {
      if (opt.target) return;
      const pointer = canvas.getScenePoint(opt.e);

      const emojiText = new FabricText(this.selectedEmoji, {
        left: pointer.x,
        top: pointer.y,
        fontSize: 40,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
      });

      canvas.add(emojiText);
      canvas.setActiveObject(emojiText);
      canvas.renderAll();
    };

    canvas.on('mouse:down', this.onClick);
  }

  deactivate(canvas: FabricCanvas): void {
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    if (this.onClick) {
      canvas.off('mouse:down', this.onClick);
      this.onClick = null;
    }
  }

  updateConfig(config: ToolConfig): void {
    this.config = config;
  }
}

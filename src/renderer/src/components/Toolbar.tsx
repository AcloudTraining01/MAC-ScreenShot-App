import React from 'react';
import {
  MousePointer2,
  MoveRight,
  Square,
  Circle,
  PenTool,
  Type,
  Droplet,
  Highlighter,
  ListOrdered,
  Crop,
  Pipette,
  Undo2,
  Redo2,
  SmilePlus,
} from 'lucide-react';
import type { ToolName } from './tools/types';
import { EMOJI_LIST } from './tools/EmojiTool';

interface ToolbarProps {
  activeTool: ToolName;
  onToolSelect: (tool: ToolName) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onEmojiChange?: (emoji: string) => void;
  selectedEmoji?: string;
}

const TOOLS: { id: ToolName; icon: React.ReactNode; tooltip: string }[] = [
  { id: 'select',      icon: <MousePointer2 size={17} />, tooltip: 'Select (V)' },
  { id: 'arrow',       icon: <MoveRight size={17} />,     tooltip: 'Arrow (A)' },
  { id: 'rect',        icon: <Square size={17} />,        tooltip: 'Rectangle (R)' },
  { id: 'ellipse',     icon: <Circle size={17} />,        tooltip: 'Ellipse (O)' },
  { id: 'pen',         icon: <PenTool size={17} />,       tooltip: 'Pen (P)' },
  { id: 'text',        icon: <Type size={17} />,          tooltip: 'Text (T)' },
  { id: 'highlight',   icon: <Highlighter size={17} />,   tooltip: 'Highlight (H)' },
  { id: 'blur',        icon: <Droplet size={17} />,       tooltip: 'Blur/Pixelate (B)' },
  { id: 'step',        icon: <ListOrdered size={17} />,   tooltip: 'Steps (S)' },
  { id: 'emoji',       icon: <SmilePlus size={17} />,     tooltip: 'Emoji Stamp (E)' },
  { id: 'crop',        icon: <Crop size={17} />,          tooltip: 'Crop (C)' },
  { id: 'eyedropper',  icon: <Pipette size={17} />,       tooltip: 'Color Picker (I)' },
];

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onEmojiChange,
  selectedEmoji = '👍',
}) => {
  return (
    <div className="toolbar-wrapper">
      {/* Row 1: Main tools + undo/redo */}
      <div className="toolbar-row-main">
        <div className="toolbar-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`toolbar-btn ${activeTool === t.id ? 'active' : ''}`}
              onClick={() => onToolSelect(t.id)}
              title={t.tooltip}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div className="divider-vertical" />
        <div className="toolbar-actions">
          <button
            className="toolbar-btn undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={17} />
          </button>
          <button
            className="toolbar-btn redo-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={17} />
          </button>
        </div>
      </div>

      {/* Row 2: Emoji picker — only visible when emoji tool is active */}
      {activeTool === 'emoji' && (
        <div className="toolbar-row-emoji">
          <span className="toolbar-emoji-label">Pick emoji:</span>
          <div className="toolbar-emoji-picker">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                className={`toolbar-emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                onClick={() => onEmojiChange?.(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;

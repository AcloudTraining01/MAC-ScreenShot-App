import React from 'react';
import type { ToolConfig, ToolName } from './tools/types';

const COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#007aff', '#5856d6', '#af52de', '#ff2d55',
  '#ffffff', '#8e8e93', '#000000'
];

interface PropertyPanelProps {
  activeTool: ToolName;
  config: ToolConfig;
  onConfigChange: (config: Partial<ToolConfig>) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  activeTool,
  config,
  onConfigChange
}) => {
  if (activeTool === 'select' || activeTool === 'crop') return null;

  return (
    <>
      <div className="property-group">
        <span>Color</span>
        <div className="color-picker">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${config.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => onConfigChange({ color: c })}
              title={c}
            />
          ))}
        </div>
      </div>

      {['arrow', 'rect', 'ellipse', 'pen', 'highlight', 'step'].includes(activeTool) && (
        <div className="property-group" style={{ marginLeft: 8 }}>
          <span>Size</span>
          <input
            type="range"
            min="1"
            max="20"
            value={config.strokeWidth}
            onChange={(e) =>
              onConfigChange({ strokeWidth: parseInt(e.target.value) })
            }
            className="range-slider"
          />
        </div>
      )}

      {activeTool === 'text' && (
        <div className="property-group" style={{ marginLeft: 8 }}>
          <span>Font</span>
          <input
            type="range"
            min="12"
            max="72"
            value={config.fontSize}
            onChange={(e) =>
              onConfigChange({ fontSize: parseInt(e.target.value) })
            }
            className="range-slider"
          />
        </div>
      )}

      {['rect', 'ellipse'].includes(activeTool) && (
        <div className="property-group" style={{ marginLeft: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.fillEnabled}
              onChange={(e) => onConfigChange({ fillEnabled: e.target.checked })}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ cursor: 'pointer' }}>Fill</span>
          </label>
        </div>
      )}
    </>
  );
};

export default PropertyPanel;

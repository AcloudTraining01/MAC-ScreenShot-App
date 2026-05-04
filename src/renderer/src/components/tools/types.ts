import type { Canvas as FabricCanvas, FabricObject } from 'fabric';

export interface ToolHandler {
  name: string;
  icon: string;
  cursor: string;
  activate(canvas: FabricCanvas): void;
  deactivate(canvas: FabricCanvas): void;
}

export type ToolName =
  | 'select'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'pen'
  | 'text'
  | 'blur'
  | 'highlight'
  | 'step'
  | 'crop'
  | 'eyedropper'
  | 'emoji';

export interface ToolConfig {
  color: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  fillEnabled: boolean;
}

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  color: '#ff3b30',
  strokeWidth: 3,
  fontSize: 20,
  opacity: 1,
  fillEnabled: false
};

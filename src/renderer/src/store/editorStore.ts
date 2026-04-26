/**
 * Editor Store — tracks the active annotation tool, colours, stroke
 * width, and canvas dirty state for the Fabric.js editor.
 */
import { create } from 'zustand';

export type ToolId =
  | 'select'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'text'
  | 'pen'
  | 'blur'
  | 'highlight'
  | 'step'
  | 'crop'
  | 'emoji'
  | 'eyedropper';

interface EditorState {
  activeTool: ToolId;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
  /** Whether the canvas has unsaved changes */
  isDirty: boolean;

  // Actions
  setActiveTool: (tool: ToolId) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (w: number) => void;
  setFontSize: (size: number) => void;
  setOpacity: (opacity: number) => void;
  setDirty: (dirty: boolean) => void;
  resetDefaults: () => void;
}

const DEFAULTS = {
  activeTool: 'select' as ToolId,
  strokeColor: '#ef4444',
  fillColor: 'transparent',
  strokeWidth: 3,
  fontSize: 20,
  opacity: 1,
  isDirty: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...DEFAULTS,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setFontSize: (size) => set({ fontSize: size }),
  setOpacity: (opacity) => set({ opacity }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  resetDefaults: () => set(DEFAULTS),
}));

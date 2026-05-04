/**
 * Capture Store — tracks the current in-flight screenshot data URI
 * and the last-capture URI for "Repeat Last Capture".
 */
import { create } from 'zustand';

interface CaptureState {
  /** The image URI currently being previewed/edited */
  currentImageUri: string | null;
  /** The URI of the most recent capture (used by "Repeat Last Capture") */
  lastImageUri: string | null;
  /** Whether a capture is currently in progress */
  isCapturing: boolean;

  // Actions
  setCurrentImage: (uri: string | null) => void;
  setIsCapturing: (capturing: boolean) => void;
  clearCurrent: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  currentImageUri: null,
  lastImageUri: null,
  isCapturing: false,

  setCurrentImage: (uri) =>
    set((state) => ({
      currentImageUri: uri,
      lastImageUri: uri ?? state.lastImageUri,
    })),

  setIsCapturing: (capturing) => set({ isCapturing: capturing }),

  clearCurrent: () => set({ currentImageUri: null }),
}));

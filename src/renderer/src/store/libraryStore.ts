/**
 * Library Store — manages the local screenshot library entries and
 * search/filter state. Loads from main process via IPC.
 */
import { create } from 'zustand';
import type { LibraryEntry } from '../../../shared/types';

interface LibraryState {
  entries: LibraryEntry[];
  searchQuery: string;
  isLoading: boolean;

  /** Computed: entries filtered by searchQuery */
  filteredEntries: () => LibraryEntry[];

  // Actions
  setEntries: (entries: LibraryEntry[]) => void;
  setSearchQuery: (q: string) => void;
  setLoading: (loading: boolean) => void;

  /** Remove a single entry from state (optimistic delete) */
  removeEntry: (id: string) => void;

  /** Update OCR text for an entry after extraction */
  updateOcrText: (id: string, ocrText: string) => void;

  /** Reload library from the main process */
  reload: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],
  searchQuery: '',
  isLoading: false,

  filteredEntries: () => {
    const { entries, searchQuery } = get();
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.filename.toLowerCase().includes(q) ||
        e.ocrText?.toLowerCase().includes(q) ||
        e.tags?.some((t) => t.toLowerCase().includes(q))
    );
  },

  setEntries: (entries) => set({ entries }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setLoading: (loading) => set({ isLoading: loading }),

  removeEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

  updateOcrText: (id, ocrText) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ocrText } : e)),
    })),

  reload: async () => {
    set({ isLoading: true });
    try {
      const entries = await window.api.getLibrary();
      set({ entries });
    } catch (err) {
      console.error('[LibraryStore] Failed to load library:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));

import React, { useEffect, useState, useCallback } from 'react';
import '../styles/library.css';

interface LibraryEntry {
  id: string;
  filename: string;
  path: string;
  timestamp: number;
  width: number;
  height: number;
  fileSize: number;
}

type SortMode = 'newest' | 'oldest' | 'largest' | 'smallest';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const LibraryWindow: React.FC = () => {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    try {
      const data = await window.api.getLibrary();
      setEntries(data);
    } catch (err) {
      console.error('[Library] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();

    const unsub = window.api.onLibraryUpdated(() => {
      loadLibrary();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.api.closeLibrary();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loadLibrary]);

  const filtered = entries
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.filename.toLowerCase().includes(q) ||
        new Date(e.timestamp).toLocaleDateString().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sort) {
        case 'newest': return b.timestamp - a.timestamp;
        case 'oldest': return a.timestamp - b.timestamp;
        case 'largest': return b.fileSize - a.fileSize;
        case 'smallest': return a.fileSize - b.fileSize;
      }
    });

  const handleDelete = (id: string) => {
    window.api.deleteScreenshot(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDelete(null);
  };

  if (loading) {
    return (
      <div className="library-container">
        <div className="library-loading">
          <div className="loading-spinner" />
          <p>Loading library…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="library-container">
      {/* ── Header ── */}
      <div className="library-header">
        <div className="library-header-left">
          <h1 className="library-title">📸 Screenshot Library</h1>
          <span className="library-count">{entries.length} screenshots</span>
        </div>
        <div className="library-header-right">
          <div className="library-search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="library-search"
              placeholder="Search screenshots…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          <select
            className="library-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="largest">Largest First</option>
            <option value="smallest">Smallest First</option>
          </select>
          <button className="library-close-btn" onClick={() => window.api.closeLibrary()} title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="library-empty">
          {search ? (
            <>
              <div className="empty-icon">🔍</div>
              <h2>No matches found</h2>
              <p>Try a different search term</p>
            </>
          ) : (
            <>
              <div className="empty-icon">📷</div>
              <h2>No screenshots yet</h2>
              <p>Take your first screenshot with <kbd>⌘+Shift+4</kbd></p>
            </>
          )}
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((entry) => (
            <div key={entry.id} className="library-card">
              <div className="card-thumbnail">
                <img
                  src={`file://${entry.path}`}
                  alt={entry.filename}
                  loading="lazy"
                  draggable={false}
                />
                <div className="card-overlay">
                  <button
                    className="card-action-btn"
                    onClick={() => window.api.openInEditor(entry.path)}
                    title="Edit"
                  >
                    🎨 Edit
                  </button>
                  <button
                    className="card-action-btn"
                    onClick={() => window.api.openInFinder(entry.path)}
                    title="Show in Finder"
                  >
                    📂 Finder
                  </button>
                  <button
                    className="card-action-btn danger"
                    onClick={() => setConfirmDelete(entry.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="card-info">
                <span className="card-date">{formatDate(entry.timestamp)}</span>
                <span className="card-meta">
                  {entry.width}×{entry.height} · {formatSize(entry.fileSize)}
                </span>
              </div>

              {/* Delete confirmation overlay */}
              {confirmDelete === entry.id && (
                <div className="delete-confirm-overlay">
                  <p>Delete this screenshot?</p>
                  <div className="delete-confirm-actions">
                    <button className="confirm-cancel" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                    <button className="confirm-delete" onClick={() => handleDelete(entry.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryWindow;

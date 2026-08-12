import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveMediaPath, mediaUrl, isInside, MediaPathError, type MediaRoots } from './mediaPath';

let base: string;
let roots: MediaRoots;
let secretPath: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'snapforge-media-'));
  roots = { sessions: join(base, 'Sessions'), library: join(base, 'Library') };
  mkdirSync(join(roots.sessions, 'lec-01', 'frames'), { recursive: true });
  mkdirSync(roots.library, { recursive: true });
  writeFileSync(join(roots.sessions, 'lec-01', 'video.mp4'), 'video-bytes');
  writeFileSync(join(roots.sessions, 'lec-01', 'frames', 'a b.jpg'), 'frame-bytes');

  // A file that must never be reachable through the protocol.
  secretPath = join(base, 'secret.txt');
  writeFileSync(secretPath, 'ssh-key');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

/** Mirrors what the protocol handler passes: URL.pathname, percent-encoded. */
function pathnameFor(url: string): string {
  return new URL(url).pathname;
}

describe('resolveMediaPath — happy path', () => {
  it('resolves a file inside a registered root', () => {
    const got = resolveMediaPath(roots, '/sessions/lec-01/video.mp4');
    expect(got.endsWith(join('Sessions', 'lec-01', 'video.mp4'))).toBe(true);
  });

  it('decodes percent-encoded segments, including spaces', () => {
    const got = resolveMediaPath(roots, '/sessions/lec-01/frames/a%20b.jpg');
    expect(got.endsWith('a b.jpg')).toBe(true);
  });

  it('round-trips a URL built by mediaUrl', () => {
    const url = mediaUrl('sessions', 'lec-01/frames/a b.jpg');
    expect(url).toBe('snapforge://media/sessions/lec-01/frames/a%20b.jpg');
    expect(() => resolveMediaPath(roots, pathnameFor(url))).not.toThrow();
  });

  it('serves the other registered root too', () => {
    writeFileSync(join(roots.library, 'shot.png'), 'png');
    expect(() => resolveMediaPath(roots, '/library/shot.png')).not.toThrow();
  });
});

describe('resolveMediaPath — traversal defences', () => {
  it('rejects ../ escaping the root', () => {
    expect(() => resolveMediaPath(roots, '/sessions/../secret.txt')).toThrow(MediaPathError);
  });

  it('rejects deeply nested ../ chains', () => {
    expect(() =>
      resolveMediaPath(roots, '/sessions/lec-01/../../../../../../etc/passwd')
    ).toThrow(/escapes its root/);
  });

  it('rejects percent-encoded traversal (%2e%2e%2f)', () => {
    // The decode happens before validation, so encoding buys an attacker nothing.
    expect(() => resolveMediaPath(roots, '/sessions/%2e%2e/secret.txt')).toThrow(MediaPathError);
  });

  it('rejects an absolute path smuggled into the relative segment', () => {
    expect(() => resolveMediaPath(roots, `/sessions/${secretPath}`)).toThrow(MediaPathError);
  });

  it('rejects a sibling directory sharing the root name as a prefix', () => {
    // Guards the classic bug of validating with a bare startsWith:
    // "/base/Sessions-evil" starts with "/base/Sessions".
    const evil = join(base, 'Sessions-evil');
    mkdirSync(evil, { recursive: true });
    writeFileSync(join(evil, 'x.mp4'), 'nope');
    expect(() => resolveMediaPath(roots, '/sessions/../Sessions-evil/x.mp4')).toThrow(
      MediaPathError
    );
  });

  it('rejects a symlink inside the root that points outside it', () => {
    const link = join(roots.sessions, 'escape.txt');
    symlinkSync(secretPath, link);
    // Containment passes on the link itself; only realpath reveals the escape.
    expect(() => resolveMediaPath(roots, '/sessions/escape.txt')).toThrow(
      /resolves outside its root/
    );
  });

  it('allows a symlink that stays inside the root', () => {
    const target = join(roots.sessions, 'lec-01', 'video.mp4');
    const link = join(roots.sessions, 'latest.mp4');
    symlinkSync(target, link);
    expect(() => resolveMediaPath(roots, '/sessions/latest.mp4')).not.toThrow();
  });
});

describe('resolveMediaPath — malformed input', () => {
  it('rejects an empty path', () => {
    expect(() => resolveMediaPath(roots, '/')).toThrow(/Empty media path/);
  });

  it('rejects a root with no file', () => {
    expect(() => resolveMediaPath(roots, '/sessions')).toThrow(/Missing file path/);
  });

  it('rejects an unknown root', () => {
    expect(() => resolveMediaPath(roots, '/etc/passwd')).toThrow(/Unknown media root/);
  });

  it('does not treat inherited Object properties as roots', () => {
    // roots is a plain object; without a hasOwnProperty guard, "constructor"
    // or "__proto__" would resolve to something truthy.
    expect(() => resolveMediaPath(roots, '/constructor/x')).toThrow(/Unknown media root/);
    expect(() => resolveMediaPath(roots, '/__proto__/x')).toThrow(/Unknown media root/);
  });

  it('rejects a NUL byte', () => {
    expect(() => resolveMediaPath(roots, '/sessions/lec-01/video.mp4%00.txt')).toThrow(
      /NUL byte/
    );
  });

  it('rejects malformed percent-encoding instead of crashing', () => {
    expect(() => resolveMediaPath(roots, '/sessions/%ZZ')).toThrow(/Malformed percent-encoding/);
  });

  it('reports 404 for a missing file and 403 for an escape', () => {
    const missing = (() => {
      try {
        resolveMediaPath(roots, '/sessions/lec-01/nope.mp4');
      } catch (e) {
        return e as MediaPathError;
      }
    })();
    const escaped = (() => {
      try {
        resolveMediaPath(roots, '/sessions/../secret.txt');
      } catch (e) {
        return e as MediaPathError;
      }
    })();

    expect(missing?.status).toBe(404);
    expect(escaped?.status).toBe(403);
  });
});

describe('isInside', () => {
  it('accepts a path equal to the parent', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true);
  });

  it('accepts a descendant', () => {
    expect(isInside('/a/b', '/a/b/c/d.txt')).toBe(true);
  });

  it('rejects a sibling with a shared prefix', () => {
    expect(isInside('/a/b', '/a/bb')).toBe(false);
  });

  it('rejects an ancestor', () => {
    expect(isInside('/a/b', '/a')).toBe(false);
  });
});

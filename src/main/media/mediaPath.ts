/**
 * Path resolution for the `snapforge://` protocol.
 *
 * Deliberately free of Electron imports: this is the security boundary for a
 * handler that turns renderer-supplied strings into filesystem reads, so it
 * needs to be exercisable directly by unit tests.
 *
 * URLs never carry absolute paths. They name a registered root by key plus a
 * relative path, and the resolved result must still sit inside that root after
 * symlinks are collapsed.
 */
import { realpathSync, existsSync } from 'fs';
import { join, resolve, sep, normalize } from 'path';
import { homedir } from 'os';

export const SCHEME = 'snapforge';

/** Logical roots the renderer may address. Absolute paths never cross IPC. */
export type MediaRoot = 'sessions' | 'library';

export type MediaRoots = Record<MediaRoot, string>;

export function defaultMediaRoots(): MediaRoots {
  return {
    sessions: join(homedir(), 'Documents', 'SnapForge', 'Sessions'),
    library: join(homedir(), 'Pictures', 'SnapForge'),
  };
}

export class MediaPathError extends Error {
  /** HTTP status the protocol handler should reply with. */
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'MediaPathError';
    this.status = status;
  }
}

export interface ResolveDeps {
  realpath?: (p: string) => string;
  exists?: (p: string) => boolean;
}

/**
 * Turns a `snapforge://media/<root>/<relative path>` pathname into an absolute
 * path, or throws `MediaPathError`.
 *
 * Filesystem calls are injectable so tests can drive the symlink-escape branch
 * without creating real symlinks.
 */
export function resolveMediaPath(
  roots: MediaRoots,
  urlPathname: string,
  deps: ResolveDeps = {}
): string {
  const realpath = deps.realpath ?? realpathSync;
  const exists = deps.exists ?? existsSync;

  // URL pathnames arrive percent-encoded and leading-slashed.
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    // e.g. a lone '%' — decodeURIComponent throws URIError
    throw new MediaPathError('Malformed percent-encoding in media path', 400);
  }
  decoded = decoded.replace(/^\/+/, '');

  if (!decoded) throw new MediaPathError('Empty media path', 400);

  // A NUL byte can truncate a path inside a syscall, so a string that passed
  // validation can reach the kernel as a different, shorter path.
  if (decoded.includes('\0')) {
    throw new MediaPathError('Illegal NUL byte in media path', 400);
  }

  const slash = decoded.indexOf('/');
  const rootKey = (slash === -1 ? decoded : decoded.slice(0, slash)) as MediaRoot;
  const relative = slash === -1 ? '' : decoded.slice(slash + 1);

  const root = Object.prototype.hasOwnProperty.call(roots, rootKey) ? roots[rootKey] : undefined;
  if (!root) throw new MediaPathError(`Unknown media root "${rootKey}"`, 404);
  if (!relative) throw new MediaPathError('Missing file path within media root', 400);

  // Reject traversal before touching the filesystem. `normalize` collapses
  // '..', so anything still escaping is caught below; failing early just gives
  // a clearer error and avoids a stat on a bogus path.
  const candidate = resolve(root, normalize(relative));
  if (!isInside(root, candidate)) {
    throw new MediaPathError('Media path escapes its root');
  }

  if (!exists(candidate)) throw new MediaPathError('No such media file', 404);

  // Re-check after collapsing symlinks: a symlink *inside* the root can point
  // anywhere, and the check above only saw the link, not its target.
  const real = realpath(candidate);
  const realRoot = exists(root) ? realpath(root) : resolve(root);
  if (!isInside(realRoot, real)) {
    throw new MediaPathError('Media path resolves outside its root');
  }

  return real;
}

/** True when `child` is `parent` itself or sits beneath it. */
export function isInside(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/** Builds a URL the renderer can use. Main-process side of the contract. */
export function mediaUrl(root: MediaRoot, relativePath: string): string {
  const encoded = relativePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${SCHEME}://media/${root}/${encoded}`;
}

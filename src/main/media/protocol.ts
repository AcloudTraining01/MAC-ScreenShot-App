/**
 * Registers the `snapforge://` protocol so renderer windows can read media.
 *
 * Lecture recordings are hundreds of megabytes. The existing screenshot flow
 * shuttles images to the renderer as base64 data-URIs over IPC, which is
 * already wasteful for a PNG and is not an option for an hour of 1080p video:
 * it would serialize the whole file into a string, copy it across the process
 * boundary, and defeat seeking entirely.
 *
 * Instead the renderer gets a URL. `net.fetch` streams the file and honours
 * Range requests, so `<video>` scrubbing behaves the way it does on the web.
 *
 * All path validation lives in `mediaPath.ts`, which is Electron-free and
 * unit-tested — see the security notes there.
 */
import { protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import {
  SCHEME,
  MediaPathError,
  defaultMediaRoots,
  resolveMediaPath,
  type MediaRoots,
} from './mediaPath';

export { SCHEME, mediaUrl, defaultMediaRoots } from './mediaPath';
export type { MediaRoot, MediaRoots } from './mediaPath';

/**
 * Must be called *before* `app.whenReady()` — Electron only accepts privileged
 * scheme registration during startup.
 *
 * `stream: true` is what enables Range requests, and therefore video seeking.
 * `standard: true` gives the scheme normal URL parsing so `new URL()` behaves.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ]);
}

/** Call once after the app is ready. */
export function installMediaProtocol(roots: MediaRoots = defaultMediaRoots()): void {
  protocol.handle(SCHEME, async (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Bad URL', { status: 400 });
    }

    if (url.hostname !== 'media') {
      return new Response('Not found', { status: 404 });
    }

    let filePath: string;
    try {
      filePath = resolveMediaPath(roots, url.pathname);
    } catch (err) {
      const status = err instanceof MediaPathError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Bad request';
      // In normal operation this never fires. If it does, either a URL is being
      // built incorrectly or something is probing the handler — worth a log.
      console.warn(`[Media] Refused ${request.url}: ${message}`);
      return new Response(message, { status });
    }

    // Forwarding the request headers is what carries Range through, so seeking
    // streams a slice instead of buffering the entire file.
    return net.fetch(pathToFileURL(filePath).toString(), {
      headers: request.headers,
      method: request.method,
    });
  });

  console.log(`[Media] ${SCHEME}:// protocol installed`);
}

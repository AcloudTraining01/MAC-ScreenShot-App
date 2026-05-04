/**
 * Platform Factory — creates and exports the correct platform adapter
 * for the current OS. All other modules import from here; they never
 * import a specific adapter directly.
 *
 * Usage:
 *   import { platform } from './platform';
 *   const dataUri = await platform.captureInteractive();
 */
import type { PlatformAdapter } from './platform.types';
import { MacPlatformAdapter } from './platform.mac';
import { WinPlatformAdapter } from './platform.win';

function createPlatformAdapter(): PlatformAdapter {
  switch (process.platform) {
    case 'darwin':
      return new MacPlatformAdapter();
    case 'win32':
      return new WinPlatformAdapter();
    default:
      // Linux / unknown — fall back to macOS adapter as a best-effort
      console.warn(`[Platform] Unsupported platform "${process.platform}" — using macOS adapter as fallback.`);
      return new MacPlatformAdapter();
  }
}

/**
 * The singleton platform adapter instance.
 * Import this everywhere instead of calling OS APIs directly.
 */
export const platform: PlatformAdapter = createPlatformAdapter();

// Re-export the interface for type annotations
export type { PlatformAdapter, ScreenPermissionStatus } from './platform.types';

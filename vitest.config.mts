import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment: these cover main-process modules, which must stay
    // importable without Electron. Renderer component tests would need their
    // own project entry with a DOM environment.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // better-sqlite3 is a native addon and cannot be transformed by Vite.
    server: { deps: { external: ['better-sqlite3'] } },
  },
});

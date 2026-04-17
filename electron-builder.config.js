// electron-builder.config.js
module.exports = {
  appId: 'com.snapforge.app',
  productName: 'SnapForge',
  copyright: 'Copyright © 2026 kingsleyasah',

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  // Files bundled inside the asar
  files: [
    'out/**/*',
    'package.json',
  ],

  // Extra resources copied verbatim into Contents/Resources/
  // (accessible at runtime via process.resourcesPath)
  extraResources: [
    { from: 'resources/trayIconTemplate.png',    to: 'trayIconTemplate.png' },
    { from: 'resources/trayIconTemplate@2x.png', to: 'trayIconTemplate@2x.png' },
  ],

  // ── macOS ──────────────────────────────────────────────
  mac: {
    // arch is passed via CLI flag in CI: --arm64 or --x64
    target: [
      { target: 'dmg' },
      { target: 'zip' },
    ],
    icon: 'resources/icon.icns',
    category: 'public.app-category.utilities',

    // Hardened runtime is required ONLY for notarization.
    // Since we are not code-signing in CI, disable it to prevent
    // codesign failures on the runner.
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },

  // ── DMG appearance ─────────────────────────────────────
  dmg: {
    sign: false,
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  // ── Auto-update via GitHub Releases ────────────────────
  publish: {
    provider: 'github',
    owner: 'AcloudTraining01',
    repo: 'MAC-ScreenShot-App',
    releaseType: 'release',
  },
};

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

    // identity: null → ad-hoc self-signing (uses macOS built-in '-' identity).
    // This prevents the "damaged and can't be opened" error that fully unsigned
    // apps get on macOS 13+. Testers will see the softer "unidentified developer"
    // warning instead, which IS bypassable via right-click → Open.
    //
    // When you have an Apple Developer account, remove identity: null and add
    // CSC_LINK + CSC_KEY_PASSWORD secrets for full notarization.
    identity: null,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlementsInherit: 'build/entitlements.mac.plist',
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

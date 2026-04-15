// electron-builder.config.js
module.exports = {
  appId: 'com.snapforge.app',
  productName: 'SnapForge',
  copyright: 'Copyright © 2025 kingsleyasah',
  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  // Files to include in the packaged app
  files: [
    'out/**/*',
    'resources/**/*',
    'package.json',
  ],

  // ── macOS ──────────────────────────────────────────────
  mac: {
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    icon: 'resources/icon.icns',
    category: 'public.app-category.utilities',
    // Hardened runtime required for notarization
    hardenedRuntime: true,
    gatekeeperAssess: false,
    // Entitlements needed for screen recording
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },

  dmg: {
    sign: false,
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  // ── Auto-update publishing via GitHub Releases ─────────
  publish: {
    provider: 'github',
    owner: 'AcloudTraining01',
    repo: 'MAC-ScreenShot-App',
    releaseType: 'release',
  },
};

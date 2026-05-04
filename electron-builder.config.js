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
  extraResources: [
    { from: 'resources/trayIconTemplate.png',    to: 'trayIconTemplate.png' },
    { from: 'resources/trayIconTemplate@2x.png', to: 'trayIconTemplate@2x.png' },
  ],

  // ── macOS ──────────────────────────────────────────────────────────────────
  mac: {
    // --universal flag in CI merges arm64 + x64 into a single fat binary.
    // Works natively on Apple Silicon AND Intel Macs without Rosetta.
    target: [
      { target: 'dmg',  arch: ['universal'] },
      { target: 'zip',  arch: ['universal'] },
    ],
    icon: 'resources/icon.icns',
    category: 'public.app-category.utilities',

    // identity: null → ad-hoc self-signing using macOS built-in '-' identity.
    // Prevents the hard "damaged and can't be opened" error on macOS 13+.
    // Testers see "unidentified developer" instead → bypassable via right-click → Open.
    //
    // To enable full notarization: remove identity: null and add
    // CSC_LINK + CSC_KEY_PASSWORD GitHub secrets (requires Apple Developer account).
    identity: null,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    // entitlements applies to the main SnapForge binary.
    // entitlementsInherit applies to Helper processes.
    // Both must point to our file so com.apple.security.device.screen-recording
    // is embedded in every binary that participates in screen capture.
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // extendInfo injects keys into the app's Info.plist at build time.
    // NSScreenCaptureUsageDescription is shown in the TCC permission dialog.
    extendInfo: {
      NSScreenCaptureUsageDescription:
        'SnapForge needs screen recording access to capture screenshots.',
    },
  },

  // ── Post-sign hook ─────────────────────────────────────────────────────────
  // Re-signs the universal binary after lipo merges arm64+x64, because the
  // merge step invalidates signatures and electron-builder does not reliably
  // re-embed custom entitlements on the resulting universal binary.
  afterSign: 'scripts/afterSign.cjs',

  // ── DMG appearance ─────────────────────────────────────────────────────────
  dmg: {
    sign: false,
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  // ── Auto-update via GitHub Releases ────────────────────────────────────────
  publish: {
    provider: 'github',
    owner: 'AcloudTraining01',
    repo: 'MAC-ScreenShot-App',
    releaseType: 'release',
  },
};

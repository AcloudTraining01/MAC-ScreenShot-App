// electron-builder.config.js

/**
 * Notarization is enabled only when Apple credentials are present in the
 * environment, so a developer without a certificate can still run
 * `npm run build:mac` and get a testable (ad-hoc signed) app.
 *
 * CI needs: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID,
 *           CSC_LINK (base64 .p12), CSC_KEY_PASSWORD.
 */
const notarizeCredentialsPresent = Boolean(
  process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
);

module.exports = {
  appId: 'com.snapforge.app',
  productName: 'SnapForge',
  copyright: 'Copyright © 2026 kingsleyasah',

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  // Files bundled inside the asar. Production dependencies from package.json
  // are copied automatically; devDependencies never are.
  files: [
    'out/**/*',
    'package.json',
  ],

  /**
   * Native code cannot be dlopen'd from inside an asar archive — the loader
   * needs a real path on disk. Anything matching these patterns is written to
   * app.asar.unpacked/ and resolved from there transparently.
   *
   * better-sqlite3 ships N-API prebuilds and its loader probes the package
   * directory at runtime, so the whole module is unpacked rather than just the
   * .node file.
   */
  asarUnpack: [
    '**/*.node',
    'node_modules/better-sqlite3/**',
  ],

  // Extra resources copied verbatim into Contents/Resources/
  extraResources: [
    { from: 'resources/trayIconTemplate.png',    to: 'trayIconTemplate.png' },
    { from: 'resources/trayIconTemplate@2x.png', to: 'trayIconTemplate@2x.png' },
  ],

  // ── macOS ──────────────────────────────────────────────────────────────────
  mac: {
    /**
     * Separate per-architecture artifacts rather than a universal binary.
     *
     * Universal builds merge arm64 + x64 with `lipo`, which is unreliable once
     * a bundle contains native addons and (from Phase 1) the bundled
     * ScreenCaptureKit recorder, whisper, and ffmpeg binaries. Two clean
     * artifacts beat one fragile one; auto-update handles multiple arches.
     */
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    icon: 'resources/icon.icns',
    category: 'public.app-category.productivity',

    /**
     * `identity` is intentionally not set, so electron-builder auto-discovers a
     * Developer ID certificate from the keychain (or CSC_LINK in CI).
     *
     * It was previously pinned to `null`, forcing ad-hoc signing. That is what
     * caused the stale screen-recording permissions this app kept fighting:
     * ad-hoc signing changes the code hash on every rebuild, and macOS keys TCC
     * grants to that hash, so every rebuild silently revoked the grant. A
     * stable Developer ID signature fixes it permanently.
     *
     * Local builds with no certificate still work — electron-builder falls back
     * to ad-hoc, and scripts/afterSign.cjs re-signs so entitlements land.
     */
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',

    notarize: notarizeCredentialsPresent ? { teamId: process.env.APPLE_TEAM_ID } : false,

    /**
     * TCC prompt strings.
     *
     * NSMicrophoneUsageDescription is the documented key and is required — the
     * mic prompt shows this text, and a missing key is an immediate crash on
     * first capture.
     *
     * Screen Recording has no officially documented Info.plist key; macOS shows
     * a system-supplied prompt and the real gate is the TCC database.
     * NSScreenCaptureUsageDescription is set anyway because it is widely used,
     * harmless, and self-documenting.
     *
     * NSAudioCaptureUsageDescription covers Apple's Core Audio tap API. The
     * Phase 1 recorder takes system audio through ScreenCaptureKit, which is
     * governed by Screen Recording instead, but this is declared so a later
     * move to Core Audio taps does not silently produce a dead audio stream.
     */
    extendInfo: {
      NSMicrophoneUsageDescription:
        'SnapForge records your microphone so it can transcribe in-person lectures and take notes for you.',
      NSScreenCaptureUsageDescription:
        'SnapForge records your screen so it can capture lecture slides and generate notes from online classes.',
      NSAudioCaptureUsageDescription:
        'SnapForge records audio played by your computer so it can transcribe online lectures and video courses.',
    },
  },

  // ── Post-sign hook ─────────────────────────────────────────────────────────
  // Verifies entitlements landed, and ad-hoc signs when no Developer ID is
  // available. Deliberately a no-op on properly signed builds.
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

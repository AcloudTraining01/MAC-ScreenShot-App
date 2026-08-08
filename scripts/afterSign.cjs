'use strict';
/**
 * afterSign hook for electron-builder.
 *
 * ## History
 *
 * This hook originally force-re-signed the whole bundle with `codesign --force
 * --deep --sign -`, to work around universal (lipo'd) builds losing their
 * entitlements. Two things changed:
 *
 *  1. We no longer build universal binaries. Native modules and the bundled
 *     Swift/whisper/ffmpeg helpers make `lipo` fragile, so releases are now
 *     separate arm64 and x64 artifacts and electron-builder signs them
 *     correctly on its own.
 *  2. Releases are signed with a Developer ID and notarized.
 *
 * Point 2 made the old behaviour actively harmful: `--sign -` replaces a valid
 * Developer ID signature with an ad-hoc one, which fails notarization. `--deep`
 * is also deprecated by Apple and applies the app's entitlements to every
 * nested helper, which is not what you want.
 *
 * ## What it does now
 *
 * Nothing, unless the bundle came out ad-hoc signed (a local build with no
 * certificate). In that case it re-signs so entitlements are still embedded and
 * local testing behaves like a real build. If a Developer ID signature is
 * present, it verifies and gets out of the way.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/** Reads the signing authority chain, or null if the bundle is unsigned. */
function describeSignature(appPath) {
  try {
    return execSync(`codesign -dvvv "${appPath}" 2>&1`, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

module.exports = async function afterSign(context) {
  if (process.platform !== 'darwin') return;

  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const entitlementsPath = path.resolve(packager.projectDir, 'build', 'entitlements.mac.plist');

  if (!fs.existsSync(appPath)) {
    console.warn(`[afterSign] App not found at ${appPath} — skipping.`);
    return;
  }

  const signature = describeSignature(appPath);
  const hasDeveloperId = Boolean(signature && signature.includes('Developer ID Application'));

  if (hasDeveloperId) {
    const authority = (signature.match(/Authority=(.+)/) || [])[1] || 'unknown';
    console.log(`[afterSign] Developer ID signature present (${authority.trim()}).`);
    console.log('[afterSign] Leaving it untouched — re-signing here would break notarization.');
    verifyEntitlements(appPath, appName);
    return;
  }

  if (!fs.existsSync(entitlementsPath)) {
    console.error(`[afterSign] Entitlements file not found at ${entitlementsPath}`);
    return;
  }

  console.log(`\n[afterSign] No Developer ID signature found — ad-hoc signing ${appName}.app.`);
  console.log('[afterSign] This build is for local testing only and will not notarize.');

  // --force           : replace any existing (including linker-only) signature
  // --options runtime : hardened runtime, so entitlements are honoured
  // --deep            : sign nested code too
  //
  // `--deep` is deprecated by Apple and must never be used for distribution
  // signing — but it is correct here, and load-bearing. When signing is skipped
  // (CSC_IDENTITY_AUTO_DISCOVERY=false, or simply no certificate installed)
  // electron-builder leaves *all* nested code unsigned: Electron Framework,
  // Mantle, Squirrel, ReactiveObjC, and the four helper apps. Signing only the
  // outer bundle then produces "code has no resources but signature indicates
  // they must be present", and macOS refuses to launch the app — it exits
  // instantly with no output and no crash report.
  //
  // The Developer ID path never reaches this branch: electron-builder signs
  // nested code inside-out itself, and we return early above.
  execSync(
    `codesign --force --deep --sign - --entitlements "${entitlementsPath}" --options runtime "${appPath}"`,
    { stdio: 'inherit' }
  );

  verifyEntitlements(appPath, appName);
  console.log('');
};

/**
 * Confirms the entitlements that actually gate functionality made it into the
 * binary. A silent omission here shows up much later as an inexplicable
 * permission denial, so it is worth failing loudly at build time.
 */
function verifyEntitlements(appPath, appName) {
  const required = [
    ['allow-jit', 'Electron JIT'],
    ['device.audio-input', 'microphone capture'],
    ['device.screen-recording', 'lecture screen recording'],
  ];

  try {
    const out = execSync(`codesign -d --entitlements - "${appPath}/Contents/MacOS/${appName}" 2>&1`, {
      encoding: 'utf8',
    });

    const missing = required.filter(([key]) => !out.includes(key));
    if (missing.length === 0) {
      console.log('[afterSign] ✓ All required entitlements embedded.');
      return;
    }

    for (const [key, why] of missing) {
      console.error(`[afterSign] ✗ MISSING entitlement "${key}" — needed for ${why}.`);
    }
    throw new Error(
      `Code signing produced a bundle missing ${missing.length} required entitlement(s). ` +
        `Shipping this would break capture at runtime.`
    );
  } catch (err) {
    // Re-throw our own assertion; swallow codesign read failures, which are
    // informational only (e.g. codesign output format differences).
    if (err instanceof Error && err.message.includes('required entitlement')) throw err;
    console.warn('[afterSign] Could not read back entitlements for verification.');
  }
}

'use strict';
/**
 * afterSign hook for electron-builder.
 *
 * Problem: when building a universal binary (arm64 + x64 merged via lipo),
 * the merge step invalidates all code signatures. electron-builder's built-in
 * re-signing does not reliably embed the custom entitlements on the resulting
 * universal binary, so the main SnapForge binary ends up with no entitlements
 * at all — in particular missing com.apple.security.device.screen-recording,
 * which causes macOS to deny screen capture access regardless of TCC state.
 *
 * Fix: after electron-builder finishes, we force-re-sign the entire app bundle
 * with --deep so every nested binary (helpers, frameworks, dylibs) gets the
 * entitlements applied in the correct inside-out order.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  if (!fs.existsSync(entitlementsPath)) {
    console.error(`[afterSign] Entitlements file not found at ${entitlementsPath}`);
    return;
  }

  console.log(`\n[afterSign] Re-signing ${appName}.app with entitlements...`);

  // --force   : replace any existing signature (including linker-signed)
  // --deep    : sign all nested code in the correct inside-out order
  // --options runtime : enable hardened runtime so entitlements are honoured
  execSync(
    `codesign --force --deep --sign - --entitlements "${entitlementsPath}" --options runtime "${appPath}"`,
    { stdio: 'inherit' }
  );

  console.log('[afterSign] Done. Verifying code signature...');

  try {
    const result = execSync(
      `codesign -d --entitlements - "${appPath}/Contents/MacOS/${appName}" 2>&1`,
      { encoding: 'utf8' }
    );
    const hasJIT = result.includes('allow-jit');
    console.log(
      hasJIT
        ? '[afterSign] ✓ Entitlements are properly embedded (allow-jit found).'
        : '[afterSign] ✗ WARNING: entitlements may not be embedded correctly!'
    );
    // Note: screen-recording entitlement is intentionally omitted.
    // We use the system `screencapture` binary which handles its own TCC access.
  } catch {
    // Non-fatal — verification is informational only
  }

  console.log('');
};

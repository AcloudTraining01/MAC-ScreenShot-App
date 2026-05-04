/**
 * Licensing Manager — validates the user's subscription tier.
 *
 * Architecture:
 *  - License is cached locally at ~/.snapforge/license.json
 *  - Validation is performed locally against the cached license
 *  - In Phase 5, `activateLicense()` will call the Supabase
 *    `validate-license` Edge Function to verify the key online
 *    and refresh `lastValidated`
 *  - An offline grace period (14 days) allows Pro features to work
 *    while the device is offline
 *
 * IPC surface (called by the renderer via preload):
 *  - get-tier          → LicenseValidationResult
 *  - activate-license  → LicenseValidationResult  (with key string)
 *  - deactivate-license → void
 */
import { ipcMain, BrowserWindow } from 'electron';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import type { License, LicenseValidationResult, UserTier } from '../shared/types';
import { IPC } from '../shared/constants';

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_DIR   = join(homedir(), '.snapforge');
const LICENSE_PATH = join(CONFIG_DIR, 'license.json');

/** Days offline before Pro features are revoked */
const GRACE_PERIOD_DAYS = 14;

// ── File I/O ──────────────────────────────────────────────────────────────────
function readLicense(): License | null {
  try {
    if (!existsSync(LICENSE_PATH)) return null;
    const raw = readFileSync(LICENSE_PATH, 'utf-8');
    return JSON.parse(raw) as License;
  } catch {
    return null;
  }
}

function writeLicense(license: License): void {
  writeFileSync(LICENSE_PATH, JSON.stringify(license, null, 2), 'utf-8');
}

function removeLicense(): void {
  if (existsSync(LICENSE_PATH)) unlinkSync(LICENSE_PATH);
}

// ── Core Validation ───────────────────────────────────────────────────────────

/**
 * Validate the cached license and return the resolved tier.
 *
 * Rules (checked in order):
 *  1. No license file  → free
 *  2. Subscription expired (`expiresAt` in the past) → free
 *  3. Last validated > GRACE_PERIOD_DAYS ago → free (offline too long)
 *  4. Otherwise → pro (or whatever tier is in the license)
 */
export function validateLicense(): LicenseValidationResult {
  const license = readLicense();

  if (!license) {
    return { valid: false, reason: 'no_license' };
  }

  // Sanity check — ensure required fields exist
  if (!license.licenseKey || !license.tier || !license.lastValidated) {
    console.warn('[Licensing] License file is malformed — treating as free.');
    return { valid: false, reason: 'tampered' };
  }

  const now = Date.now();

  // Check hard expiry
  if (license.expiresAt) {
    const expiry = new Date(license.expiresAt).getTime();
    if (now > expiry) {
      console.log('[Licensing] Subscription expired on', license.expiresAt);
      return { valid: false, reason: 'expired' };
    }
  }

  // Check offline grace period
  const lastValidated = new Date(license.lastValidated).getTime();
  const daysSince = (now - lastValidated) / (1000 * 60 * 60 * 24);
  if (daysSince > GRACE_PERIOD_DAYS) {
    console.warn(
      `[Licensing] Grace period exceeded (${Math.floor(daysSince)} days since last validation).`
    );
    return { valid: false, reason: 'grace_period_exceeded' };
  }

  return { valid: true, tier: license.tier, email: license.email };
}

/** Returns just the resolved tier string — convenience wrapper */
export function getResolvedTier(): UserTier {
  const result = validateLicense();
  return result.valid ? result.tier : 'free';
}

// ── Activation ────────────────────────────────────────────────────────────────

/**
 * Activate a license key on this machine.
 *
 * In Phase 5 this will make a POST to the Supabase
 * `validate-license` Edge Function. For now it trusts a locally
 * crafted license object (dev / testing mode).
 *
 * @param key   The license key string entered by the user
 */
export async function activateLicense(key: string): Promise<LicenseValidationResult> {
  // ── Phase 5: replace stub with Supabase Edge Function call ───────────────
  // const resp = await fetch(`${SUPABASE_URL}/functions/v1/validate-license`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ licenseKey: key, machineId: getMachineId() }),
  // });
  // const data = await resp.json();
  // ─────────────────────────────────────────────────────────────────────────

  // Dev / offline stub: treat any non-empty key starting with 'PRO-' as valid
  const isValidFormat = typeof key === 'string' && key.trim().toUpperCase().startsWith('PRO-');

  if (!isValidFormat) {
    console.warn('[Licensing] Invalid license key format:', key);
    return { valid: false, reason: 'tampered' };
  }

  const now = new Date().toISOString();
  const license: License = {
    licenseKey: key.trim(),
    email: 'user@snapforge.app',   // Phase 5: from Supabase JWT
    tier: 'pro',
    activatedAt: now,
    lastValidated: now,
    // expiresAt is omitted → lifetime license for dev testing
  };

  writeLicense(license);
  console.log('[Licensing] License activated:', key);

  return { valid: true, tier: 'pro', email: license.email };
}

/** Remove the local license and revert to free tier */
export function deactivateLicense(): void {
  removeLicense();
  console.log('[Licensing] License deactivated — reverted to free tier.');
}

// ── IPC Setup ─────────────────────────────────────────────────────────────────

/**
 * Broadcast a tier change to all open renderer windows.
 * Called after activation / deactivation.
 */
function broadcastTierChange(result: LicenseValidationResult): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.LICENSE_CHANGED, result);
    }
  }
}

/**
 * Register all licensing IPC handlers.
 * Call once during app initialisation.
 */
export function setupLicensingIPC(): void {
  // Renderer asks: "what tier am I on?"
  ipcMain.handle(IPC.GET_TIER, () => {
    return validateLicense();
  });

  // Renderer submits a license key to activate
  ipcMain.handle(IPC.ACTIVATE_LICENSE, async (_event, key: string) => {
    const result = await activateLicense(key);
    broadcastTierChange(result);
    return result;
  });

  // Renderer (or sign-out flow) deactivates the license
  ipcMain.on(IPC.DEACTIVATE_LICENSE, () => {
    deactivateLicense();
    const result: LicenseValidationResult = { valid: false, reason: 'no_license' };
    broadcastTierChange(result);
  });
}

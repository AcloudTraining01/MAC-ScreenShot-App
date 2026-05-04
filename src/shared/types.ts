/**
 * Shared types used across main, preload, and renderer processes.
 * Keep this file free of Node.js or browser-only imports.
 */

// ── Library ──────────────────────────────────────────────────────────────────
export interface LibraryEntry {
  id: string;
  filename: string;
  path: string;
  timestamp: number;
  width: number;
  height: number;
  fileSize: number;
  /** OCR-extracted text for full-text search (optional, set after OCR) */
  ocrText?: string;
  /** Auto-generated tags (optional, set after tagging) */
  tags?: string[];
}

// ── Settings ─────────────────────────────────────────────────────────────────
export interface AppSettings {
  /** Global shortcut for region capture */
  captureHotkey: string;
  /** Global shortcut for opening the library */
  libraryHotkey: string;
  /** Where to save screenshots */
  saveDirectory: string;
  /** Whether to save every capture to the library automatically */
  autoSaveToLibrary: boolean;
  /** Whether to copy to clipboard after every capture */
  copyOnCapture: boolean;
  /** Launch app on login (Pro feature) */
  launchOnLogin: boolean;
  /** UI theme preference */
  theme: 'system' | 'dark' | 'light';
  /** Whether the user has completed the first-launch onboarding flow */
  hasCompletedOnboarding: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  captureHotkey: 'CmdOrCtrl+Shift+4',
  libraryHotkey: 'CmdOrCtrl+Shift+L',
  saveDirectory: '',          // Empty = Pictures/SnapForge (resolved at runtime)
  autoSaveToLibrary: true,
  copyOnCapture: false,
  launchOnLogin: false,
  theme: 'system',
  hasCompletedOnboarding: false,
};

// ── Auth / Licensing ─────────────────────────────────────────────────────────
export type UserTier = 'free' | 'pro';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  tier: UserTier;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled' | 'trialing';
  subscriptionEndDate?: string; // ISO date string
}

// ── OCR ──────────────────────────────────────────────────────────────────────
export interface OcrResult {
  text: string;
  confidence: number;
  /** Bounding boxes for each recognized word */
  words?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

// ── Licensing ─────────────────────────────────────────────────────────────────
export interface License {
  /** Opaque key issued by the licensing backend (Supabase in Phase 5) */
  licenseKey: string;
  /** User email the license was issued to */
  email: string;
  /** Granted subscription tier */
  tier: UserTier;
  /** ISO date string when the license was activated on this machine */
  activatedAt: string;
  /**
   * ISO date string when the subscription expires.
   * undefined = lifetime / no expiry.
   */
  expiresAt?: string;
  /**
   * ISO date string of the last successful online validation.
   * Used to enforce the offline grace period.
   */
  lastValidated: string;
}

export type LicenseValidationResult =
  | { valid: true;  tier: UserTier; email: string }
  | { valid: false; reason: 'expired' | 'grace_period_exceeded' | 'no_license' | 'tampered' };


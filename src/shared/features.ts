/**
 * Central feature registry — single source of truth for Free vs Pro gating.
 *
 * Rules:
 *  - tier: 'free'  → always available (with optional dailyLimit)
 *  - tier: 'pro'   → blocked for free users, shown with upgrade prompt
 *  - dailyLimit    → free users can use the feature N times per calendar day
 */

import { UserTier } from './types';

export interface FeatureConfig {
  /** Minimum tier required to access this feature */
  tier: UserTier;
  /** Optional daily usage cap for free-tier users (undefined = unlimited) */
  dailyLimit?: number;
  /** Human-readable display label */
  label: string;
  /** Short description shown in upgrade prompts */
  description: string;
  /** Emoji icon for UI use */
  icon: string;
}

export const FEATURES: Record<string, FeatureConfig> = {
  // ── Always Free ────────────────────────────────────────────────────────────
  'capture.region': {
    tier: 'free',
    label: 'Region Capture',
    description: 'Drag to capture any area of your screen',
    icon: '✂️',
  },
  'capture.fullscreen': {
    tier: 'free',
    label: 'Full Screen Capture',
    description: 'Capture your entire screen instantly',
    icon: '🖥️',
  },
  'capture.window': {
    tier: 'free',
    label: 'Window Capture',
    description: 'Capture a specific application window',
    icon: '🪟',
  },
  'edit.arrow': {
    tier: 'free',
    label: 'Arrow Tool',
    description: 'Draw customizable arrows',
    icon: '➡️',
  },
  'edit.rect': {
    tier: 'free',
    label: 'Rectangle Tool',
    description: 'Draw rectangles and shapes',
    icon: '⬜',
  },
  'edit.text': {
    tier: 'free',
    label: 'Text Tool',
    description: 'Add text labels to screenshots',
    icon: '✏️',
  },
  'edit.pen': {
    tier: 'free',
    label: 'Freehand Drawing',
    description: 'Draw freely on screenshots',
    icon: '🖊️',
  },
  'edit.crop': {
    tier: 'free',
    label: 'Crop & Resize',
    description: 'Crop and resize screenshots',
    icon: '✂️',
  },
  'edit.undo': {
    tier: 'free',
    label: 'Undo / Redo',
    description: 'Full undo and redo history',
    icon: '↩️',
  },

  // ── Free with Daily Limits ─────────────────────────────────────────────────
  'edit.blur': {
    tier: 'free',
    dailyLimit: 3,
    label: 'Blur Tool',
    description: 'Blur sensitive areas (3 uses/day free)',
    icon: '🫧',
  },
  'smart.ocr': {
    tier: 'free',
    dailyLimit: 5,
    label: 'OCR Text Extraction',
    description: 'Extract text from screenshots (5 uses/day free)',
    icon: '📄',
  },
  'smart.beautifier': {
    tier: 'free',
    dailyLimit: 3,
    label: 'Screenshot Beautifier',
    description: 'Add beautiful backgrounds (3 presets free)',
    icon: '✨',
  },
  'cloud.share': {
    tier: 'free',
    dailyLimit: 5,
    label: 'Share Links',
    description: 'Generate shareable links (5/month free)',
    icon: '🔗',
  },

  // ── Pro Only ──────────────────────────────────────────────────────────────
  'edit.highlight': {
    tier: 'pro',
    label: 'Highlight Tool',
    description: 'Semi-transparent highlighter pen',
    icon: '🖍️',
  },
  'edit.steps': {
    tier: 'pro',
    label: 'Step Counters',
    description: 'Add numbered step badges for guides',
    icon: '1️⃣',
  },
  'edit.emoji': {
    tier: 'pro',
    label: 'Emoji Stamps',
    description: 'Drag and drop emoji onto screenshots',
    icon: '😀',
  },
  'edit.colorpicker': {
    tier: 'pro',
    label: 'Color Picker / Eyedropper',
    description: 'Pick any color from the screen',
    icon: '💧',
  },
  'smart.redact': {
    tier: 'pro',
    label: 'AI Smart Redact',
    description: 'Auto-detect and redact PII in screenshots',
    icon: '🔐',
  },
  'smart.qr': {
    tier: 'pro',
    label: 'QR Code Scanner',
    description: 'Detect and decode QR codes in screenshots',
    icon: '📱',
  },
  'smart.ruler': {
    tier: 'pro',
    label: 'Screen Ruler',
    description: 'Measure pixel distances on screen',
    icon: '📏',
  },
  'smart.pixelzoom': {
    tier: 'pro',
    label: 'Pixel Zoom Inspector',
    description: 'Magnify any area for pixel-perfect inspection',
    icon: '🔍',
  },
  'smart.imagesearch': {
    tier: 'pro',
    label: 'Similar Image Search',
    description: 'Find visually similar images online',
    icon: '🔎',
  },
  'library.unlimited': {
    tier: 'pro',
    label: 'Unlimited Library',
    description: 'Keep unlimited screenshot history',
    icon: '📚',
  },
  'library.aitags': {
    tier: 'pro',
    label: 'AI-Powered Tags',
    description: 'Auto-tag screenshots by content',
    icon: '🏷️',
  },
  'library.textsearch': {
    tier: 'pro',
    label: 'Full-Text Search',
    description: 'Search your library using OCR-extracted text',
    icon: '🔍',
  },
  'export.advanced': {
    tier: 'pro',
    label: 'Advanced Export',
    description: 'Export as WebP, PDF, or SVG',
    icon: '📤',
  },
  'capture.scrolling': {
    tier: 'pro',
    label: 'Scrolling Capture',
    description: 'Capture full-length web pages',
    icon: '📜',
  },
  'capture.gif': {
    tier: 'pro',
    label: 'GIF Recording',
    description: 'Record short screen GIFs',
    icon: '🎞️',
  },
  'system.autostart': {
    tier: 'pro',
    label: 'Start on Login',
    description: 'Launch SnapForge automatically at system startup',
    icon: '🚀',
  },
};

/**
 * Checks whether a feature is available for the given tier and usage count.
 */
export function checkFeatureAccess(
  featureKey: string,
  tier: UserTier,
  todayUsage: number = 0
): { allowed: boolean; reason?: 'pro_required' | 'limit_reached'; feature?: FeatureConfig } {
  const feature = FEATURES[featureKey];
  if (!feature) return { allowed: false, reason: 'pro_required' };

  // Pro users get everything
  if (tier === 'pro') return { allowed: true, feature };

  // Feature requires Pro
  if (feature.tier === 'pro') return { allowed: false, reason: 'pro_required', feature };

  // Free feature with daily limit
  if (feature.dailyLimit !== undefined && todayUsage >= feature.dailyLimit) {
    return { allowed: false, reason: 'limit_reached', feature };
  }

  return { allowed: true, feature };
}

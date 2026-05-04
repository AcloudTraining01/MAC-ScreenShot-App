/**
 * PII (Personally Identifiable Information) Detector
 * Uses regex patterns to detect sensitive data in text extracted via OCR.
 */

export type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'dob';

export interface PIIMatch {
  type: PIIType;
  value: string;
  startIndex: number;
  endIndex: number;
  label: string;
  icon: string;
}

// ── Regex patterns for PII detection ──
const PII_PATTERNS: { type: PIIType; regex: RegExp; label: string; icon: string }[] = [
  // Email addresses
  {
    type: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    label: 'Email Address',
    icon: '📧'
  },
  // Phone numbers (US formats + international)
  {
    type: 'phone',
    regex: /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    label: 'Phone Number',
    icon: '📱'
  },
  // Social Security Numbers
  {
    type: 'ssn',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    label: 'SSN',
    icon: '🔐'
  },
  // Credit card numbers (Visa, Mastercard, Amex, Discover)
  {
    type: 'credit_card',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})(?:[-\s]?\d{4}){0,3}\b/g,
    label: 'Credit Card',
    icon: '💳'
  },
  // IP addresses (IPv4)
  {
    type: 'ip_address',
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    label: 'IP Address',
    icon: '🌐'
  },
  // Dates of Birth (MM/DD/YYYY, MM-DD-YYYY, etc.)
  {
    type: 'dob',
    regex: /\b(?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
    label: 'Date of Birth',
    icon: '📅'
  }
];

/**
 * Detect all PII matches in the given text.
 */
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];

  for (const pattern of PII_PATTERNS) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.regex.exec(text)) !== null) {
      // Filter out SSN false positives (phone numbers that look like SSNs)
      if (pattern.type === 'ssn') {
        const val = match[0].replace(/[-\s]/g, '');
        // Skip if it looks like a phone number (area codes 100-999)
        if (val.length > 9) continue;
        // Skip common false positives (all zeros, sequential)
        if (val === '000000000' || val === '123456789') continue;
      }

      matches.push({
        type: pattern.type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        label: pattern.label,
        icon: pattern.icon
      });
    }
  }

  // Remove duplicates (same value at same position)
  const unique = matches.filter((m, i, arr) =>
    arr.findIndex((o) => o.startIndex === m.startIndex && o.type === m.type) === i
  );

  return unique.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Redact PII in text by replacing matches with [REDACTED] markers.
 */
export function redactText(text: string): string {
  const matches = detectPII(text);
  let result = text;
  // Process from end to start so indices remain valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    result = result.substring(0, m.startIndex) + `[${m.label.toUpperCase()} REDACTED]` + result.substring(m.endIndex);
  }
  return result;
}

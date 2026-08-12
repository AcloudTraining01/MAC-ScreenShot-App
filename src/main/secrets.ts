/**
 * Encrypted credential store.
 *
 * Holds the API keys the study features need — Anthropic, and later a Google
 * refresh token and any cloud transcription/TTS keys. Values are encrypted with
 * Electron's `safeStorage`, which on macOS derives its key from the login
 * Keychain, so the on-disk file is useless without the user's account.
 *
 * Two deliberate properties:
 *
 *  - **Never falls back to plaintext.** If encryption is unavailable the write
 *    fails loudly. Silently writing an API key in the clear would be a worse
 *    outcome than the feature not working.
 *  - **Main-process only.** Nothing here is exposed over IPC as a getter, so a
 *    compromised renderer cannot read a key back out. The renderer may ask
 *    whether a key *exists* and may set one; only main can use its value.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type SecretKey =
  | 'anthropic.apiKey'
  | 'google.refreshToken'
  | 'deepgram.apiKey'
  | 'elevenlabs.apiKey';

/**
 * The encryption primitives, injected so the file-handling logic can be tested
 * without a running Electron app.
 */
export interface CryptoBackend {
  isAvailable(): boolean;
  encrypt(plaintext: string): Buffer;
  decrypt(ciphertext: Buffer): string;
}

/** Shape persisted to disk: key → base64 ciphertext. */
type SecretsFile = Record<string, string>;

export class SecretStore {
  private readonly filePath: string;
  private readonly crypto: CryptoBackend;
  private cache: SecretsFile | null = null;

  constructor(crypto: CryptoBackend, filePath?: string) {
    this.crypto = crypto;
    this.filePath = filePath ?? join(homedir(), '.snapforge', 'secrets.json');
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** Returns the decrypted value, or null if unset or undecryptable. */
  get(key: SecretKey): string | null {
    const encoded = this.read()[key];
    if (!encoded) return null;

    try {
      return this.crypto.decrypt(Buffer.from(encoded, 'base64'));
    } catch (err) {
      // Reachable in practice: restoring ~/.snapforge to a different machine
      // or user account leaves ciphertext that no longer decrypts. Treat it as
      // absent so the app prompts for a new key instead of crashing.
      console.error(`[Secrets] Could not decrypt "${key}" — treating as unset:`, err);
      return null;
    }
  }

  /** Cheap existence check safe to expose to the renderer. */
  has(key: SecretKey): boolean {
    return this.get(key) !== null;
  }

  /** Which keys are currently populated — drives Settings UI state. */
  listPresent(): SecretKey[] {
    return (Object.keys(this.read()) as SecretKey[]).filter((k) => this.has(k));
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /** Stores a value encrypted. Throws if the platform cannot encrypt. */
  set(key: SecretKey, value: string): void {
    if (!this.crypto.isAvailable()) {
      throw new Error(
        'Encryption is unavailable on this system, so SnapForge will not store ' +
          'the credential. On macOS this usually means the login Keychain is locked.'
      );
    }

    const trimmed = value.trim();
    if (!trimmed) {
      this.delete(key);
      return;
    }

    const next = { ...this.read(), [key]: this.crypto.encrypt(trimmed).toString('base64') };
    this.write(next);
  }

  delete(key: SecretKey): void {
    const next = { ...this.read() };
    delete next[key];
    this.write(next);
  }

  /** Drops every stored credential — used by "sign out of everything". */
  clear(): void {
    this.write({});
  }

  // ── Disk ─────────────────────────────────────────────────────────────────

  private read(): SecretsFile {
    if (this.cache) return this.cache;

    let loaded: SecretsFile = {};
    if (existsSync(this.filePath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        // Guard against a hand-edited or truncated file producing a non-object.
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          loaded = parsed as SecretsFile;
        }
      } catch (err) {
        console.error('[Secrets] secrets.json is unreadable — starting empty:', err);
      }
    }

    this.cache = loaded;
    return loaded;
  }

  private write(next: SecretsFile): void {
    mkdirSync(join(this.filePath, '..'), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
    // Ciphertext is already useless without the Keychain, but there is no
    // reason for it to be world-readable.
    try {
      chmodSync(this.filePath, 0o600);
    } catch {
      /* best effort — a failed chmod should not break saving a key */
    }
    this.cache = next;
  }
}

// ─── Electron-backed singleton ───────────────────────────────────────────────

/**
 * Wraps Electron's safeStorage. `electron` is required lazily so importing this
 * module from a test (or any non-Electron context) does not pull in the runtime.
 */
const electronBackend: CryptoBackend = {
  isAvailable: () => {
    const { safeStorage } = require('electron');
    return safeStorage.isEncryptionAvailable();
  },
  encrypt: (plaintext) => {
    const { safeStorage } = require('electron');
    return safeStorage.encryptString(plaintext);
  },
  decrypt: (ciphertext) => {
    const { safeStorage } = require('electron');
    return safeStorage.decryptString(ciphertext);
  },
};

let instance: SecretStore | null = null;

/** The app-wide store. Main process only. */
export function secrets(): SecretStore {
  if (!instance) instance = new SecretStore(electronBackend);
  return instance;
}

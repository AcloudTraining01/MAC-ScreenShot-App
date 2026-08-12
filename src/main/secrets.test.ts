import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SecretStore, type CryptoBackend } from './secrets';

/**
 * Stand-in for safeStorage. Reversible but not plaintext, so a test asserting
 * "the key is not readable on disk" is meaningful.
 */
function fakeBackend(available = true): CryptoBackend {
  return {
    isAvailable: () => available,
    encrypt: (plain) => Buffer.from([...Buffer.from(plain, 'utf-8')].map((b) => b ^ 0x5a)),
    decrypt: (blob) => Buffer.from([...blob].map((b) => b ^ 0x5a)).toString('utf-8'),
  };
}

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'snapforge-secrets-'));
  file = join(dir, 'secrets.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('SecretStore', () => {
  it('round-trips a value', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', 'sk-ant-secret');
    expect(store.get('anthropic.apiKey')).toBe('sk-ant-secret');
  });

  it('persists across instances', () => {
    new SecretStore(fakeBackend(), file).set('anthropic.apiKey', 'sk-ant-secret');
    expect(new SecretStore(fakeBackend(), file).get('anthropic.apiKey')).toBe('sk-ant-secret');
  });

  it('never writes the value in the clear', () => {
    new SecretStore(fakeBackend(), file).set('anthropic.apiKey', 'sk-ant-secret');
    expect(readFileSync(file, 'utf-8')).not.toContain('sk-ant-secret');
  });

  it('writes the file owner-only', () => {
    new SecretStore(fakeBackend(), file).set('anthropic.apiKey', 'k');
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('returns null for an unset key', () => {
    expect(new SecretStore(fakeBackend(), file).get('google.refreshToken')).toBeNull();
  });

  it('refuses to store anything when encryption is unavailable', () => {
    const store = new SecretStore(fakeBackend(false), file);
    expect(() => store.set('anthropic.apiKey', 'sk-ant-secret')).toThrow(/Encryption is unavailable/);
    // Critically: nothing was written, not even plaintext.
    expect(existsSync(file)).toBe(false);
  });

  it('trims surrounding whitespace from pasted keys', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', '  sk-ant-secret\n');
    expect(store.get('anthropic.apiKey')).toBe('sk-ant-secret');
  });

  it('treats setting an empty value as a delete', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', 'sk-ant-secret');
    store.set('anthropic.apiKey', '   ');
    expect(store.get('anthropic.apiKey')).toBeNull();
    expect(store.has('anthropic.apiKey')).toBe(false);
  });

  it('deletes one key without disturbing the others', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', 'a');
    store.set('deepgram.apiKey', 'd');
    store.delete('anthropic.apiKey');
    expect(store.get('anthropic.apiKey')).toBeNull();
    expect(store.get('deepgram.apiKey')).toBe('d');
  });

  it('reports which keys are present', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', 'a');
    store.set('elevenlabs.apiKey', 'e');
    expect(store.listPresent().sort()).toEqual(['anthropic.apiKey', 'elevenlabs.apiKey']);
  });

  it('clears everything', () => {
    const store = new SecretStore(fakeBackend(), file);
    store.set('anthropic.apiKey', 'a');
    store.set('deepgram.apiKey', 'd');
    store.clear();
    expect(store.listPresent()).toEqual([]);
  });

  it('treats an undecryptable value as unset rather than throwing', () => {
    // Reproduces restoring ~/.snapforge onto a different machine: the file is
    // valid JSON but the ciphertext belongs to another Keychain.
    writeFileSync(file, JSON.stringify({ 'anthropic.apiKey': 'not-valid-ciphertext' }));
    const exploding: CryptoBackend = {
      isAvailable: () => true,
      encrypt: () => Buffer.from(''),
      decrypt: () => {
        throw new Error('decrypt failed');
      },
    };
    const store = new SecretStore(exploding, file);
    expect(store.get('anthropic.apiKey')).toBeNull();
    expect(store.has('anthropic.apiKey')).toBe(false);
  });

  it('starts empty when the file is corrupt', () => {
    writeFileSync(file, '{ this is not json');
    const store = new SecretStore(fakeBackend(), file);
    expect(store.listPresent()).toEqual([]);
    // And can still be written to afterwards.
    store.set('anthropic.apiKey', 'recovered');
    expect(store.get('anthropic.apiKey')).toBe('recovered');
  });

  it('starts empty when the file contains a non-object', () => {
    writeFileSync(file, '["unexpected"]');
    expect(new SecretStore(fakeBackend(), file).listPresent()).toEqual([]);
  });
});

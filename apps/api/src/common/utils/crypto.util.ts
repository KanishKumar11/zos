// AES-256-GCM encryption helpers for sensitive at-rest fields (e.g. bank account number).
// Key is read once from process.env.ENCRYPTION_KEY (must be 32 bytes after base64 decode or raw).
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? '';
  // Support both base64-encoded 32-byte and raw 32-char keys.
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
    if (key.length !== 32) key = Buffer.from(raw, 'utf-8');
  } catch {
    key = Buffer.from(raw, 'utf-8');
  }
  if (key.length < 32) {
    // Pad/truncate deterministically to 32 bytes (dev convenience; rotate in prod).
    const out = Buffer.alloc(32);
    key.copy(out);
    return out;
  }
  return key.subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, encB64, tagB64] = payload.split('.');
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Invalid ciphertext');
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]);
  return dec.toString('utf-8');
}

/** Returns last 4 visible characters with the rest masked. */
export function maskAccount(value: string): string {
  if (!value) return '';
  const visible = value.slice(-4);
  return `${'•'.repeat(Math.max(0, value.length - 4))}${visible}`;
}

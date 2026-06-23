import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const utf8 = new TextEncoder();
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function b64(buffer) { return Buffer.from(buffer).toString('base64'); }
function fromB64(value, name) {
  if (typeof value !== 'string' || !BASE64.test(value)) throw new Error(`Invalid ${name}.`);
  return Buffer.from(value, 'base64');
}
function context(jobId) { return Buffer.from(`aios-network-v1:${jobId}`, 'utf8'); }
function deriveSecret(privateJwk, publicJwk, salt, jobId) {
  const privateKey = createPrivateKey({ key: privateJwk, format: 'jwk' });
  const publicKey = createPublicKey({ key: publicJwk, format: 'jwk' });
  const secret = diffieHellman({ privateKey, publicKey });
  return hkdfSync('sha256', secret, salt, context(jobId), 32);
}

export async function loadOrCreateKeyPair(keysDir) {
  await mkdir(keysDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(keysDir, 'node-ecdh-keypair.json');
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    if (parsed?.privateKeyJwk?.kty === 'EC' && parsed?.publicKeyJwk?.crv === 'P-256') return parsed;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pair = { privateKeyJwk: privateKey.export({ format: 'jwk' }), publicKeyJwk: publicKey.export({ format: 'jwk' }) };
  await writeFile(filePath, JSON.stringify(pair), { mode: 0o600 });
  await chmod(filePath, 0o600);
  return pair;
}

export function decryptJob(envelope, nodePrivateKeyJwk, jobId) {
  const salt = fromB64(envelope.salt, 'salt');
  const iv = fromB64(envelope.iv, 'iv');
  const encrypted = fromB64(envelope.ciphertext, 'ciphertext');
  if (iv.byteLength !== 12 || salt.byteLength < 16) throw new Error('Invalid encrypted request parameters.');
  const authTag = encrypted.subarray(encrypted.byteLength - 16);
  const ciphertext = encrypted.subarray(0, encrypted.byteLength - 16);
  const key = deriveSecret(nodePrivateKeyJwk, envelope.ephemeralPublicKeyJwk, salt, jobId);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(context(jobId));
  decipher.setAuthTag(authTag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

export function encryptResult(value, nodePrivateKeyJwk, requesterPublicKeyJwk, jobId) {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = deriveSecret(nodePrivateKeyJwk, requesterPublicKeyJwk, salt, jobId);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(context(jobId));
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { salt: b64(salt), iv: b64(iv), ciphertext: b64(Buffer.concat([encrypted, tag])) };
}

export type PublicComputeNode = {
  id: string;
  displayName: string;
  models: string[];
  maxConcurrentJobs: number;
  runningJobs: number;
  publicKeyJwk: JsonWebKey;
  updatedAt: number;
};

type SealedEnvelope = {
  ephemeralPublicKeyJwk: JsonWebKey;
  salt: string;
  iv: string;
  ciphertext: string;
};

type ResultEnvelope = Omit<SealedEnvelope, 'ephemeralPublicKeyJwk'>;
type PendingKey = CryptoKey;

const pendingPrivateKeys = new Map<string, PendingKey>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function apiUrl(): string | null {
  const value = import.meta.env.VITE_COMPUTE_API_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function jobContext(jobId: string): Uint8Array {
  return encoder.encode(`aios-network-v1:${jobId}`);
}

async function deriveAesKey(privateKey: CryptoKey, remotePublicJwk: JsonWebKey, salt: Uint8Array, jobId: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const remoteKey = await crypto.subtle.importKey('jwk', remotePublicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: remoteKey }, privateKey, 256);
  const hkdf = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: jobContext(jobId) }, hkdf, { name: 'AES-GCM', length: 256 }, false, usages);
}

async function encryptedRequest(jobId: string, nodePublicKeyJwk: JsonWebKey, payload: unknown): Promise<SealedEnvelope> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(keyPair.privateKey, nodePublicKeyJwk, salt, jobId, ['encrypt']);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: jobContext(jobId) }, key, plaintext);
  pendingPrivateKeys.set(jobId, keyPair.privateKey);
  return {
    ephemeralPublicKeyJwk: await crypto.subtle.exportKey('jwk', keyPair.publicKey),
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptResult(jobId: string, nodePublicKeyJwk: JsonWebKey, envelope: ResultEnvelope): Promise<{ content: string }> {
  const privateKey = pendingPrivateKeys.get(jobId);
  if (!privateKey) throw new Error('The private key for this network job is no longer available. Start a new request.');
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const key = await deriveAesKey(privateKey, nodePublicKeyJwk, salt, jobId, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: jobContext(jobId) }, key, fromBase64(envelope.ciphertext));
  pendingPrivateKeys.delete(jobId);
  const result = JSON.parse(decoder.decode(plaintext));
  if (!result || typeof result.content !== 'string') throw new Error('The provider returned an invalid encrypted response.');
  return result;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = apiUrl();
  if (!baseUrl) throw new Error('Community Device is not configured for this deployment.');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Could not reach the Community Device coordinator. Check VITE_COMPUTE_API_URL, HTTPS and CORS.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? `Community Device request failed (${response.status}).`);
  return body as T;
}

export function networkComputeConfigured(): boolean {
  return Boolean(apiUrl() && globalThis.isSecureContext && globalThis.crypto?.subtle);
}

export async function listPublicNodes(model: string): Promise<PublicComputeNode[]> {
  const response = await request<{ nodes: PublicComputeNode[] }>(`/v1/nodes?model=${encodeURIComponent(model)}`, { method: 'GET' });
  return response.nodes.filter((node) => node.models.includes(model) && node.runningJobs < node.maxConcurrentJobs);
}

export async function submitNetworkChat(input: {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!networkComputeConfigured()) throw new Error('Community Device requires a configured HTTPS endpoint and modern browser cryptography.');
  input.onStatus?.('Finding an available opted-in provider...');
  const nodes = await listPublicNodes(input.model);
  const node = [...nodes].sort((left, right) => (left.runningJobs / left.maxConcurrentJobs) - (right.runningJobs / right.maxConcurrentJobs))[0];
  if (!node) throw new Error('No opted-in provider is available for this model. Use local mode or try later.');
  const jobId = crypto.randomUUID();
  try {
    const envelope = await encryptedRequest(jobId, node.publicKeyJwk, { messages: input.messages });
    input.onStatus?.(`Sending an encrypted request to ${node.displayName}...`);
    await request('/v1/jobs', {
      method: 'POST',
      signal: input.signal,
      body: JSON.stringify({ id: jobId, targetNodeId: node.id, model: input.model, maxTokens: input.maxTokens ?? 512, envelope }),
    });
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      if (input.signal?.aborted) throw new DOMException('Network request was stopped.', 'AbortError');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = await request<{ job: { status: string; resultEnvelope?: ResultEnvelope | null; errorCode?: string | null } }>(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', signal: input.signal });
      if (status.job.status === 'completed' && status.job.resultEnvelope) {
        input.onStatus?.('Decrypting the provider response locally...');
        const result = await decryptResult(jobId, node.publicKeyJwk, status.job.resultEnvelope);
        return result.content;
      }
      if (status.job.status === 'failed') throw new Error(`Community Device job failed: ${status.job.errorCode ?? 'UNKNOWN_ERROR'}.`);
      input.onStatus?.(status.job.status === 'running' ? `${node.displayName} is generating...` : 'Encrypted job is queued...');
    }
    throw new Error('Community Device job timed out.');
  } finally {
    pendingPrivateKeys.delete(jobId);
  }
}

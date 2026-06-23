import { config } from './config.mjs';
import { decryptJob, encryptResult, loadOrCreateKeyPair } from './crypto.mjs';
import { generateWithOllama } from './ollama.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keyPair = await loadOrCreateKeyPair(config.keysDir);
const headers = { 'content-type': 'application/json', 'x-node-id': config.nodeId, 'x-node-token': config.nodeToken };

async function api(path, options = {}) {
  const response = await fetch(`${config.coordinatorUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  if (response.status === 204) return null;
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Coordinator ${response.status}: ${body?.message ?? text}`);
  return body;
}

async function register() {
  await api('/v1/nodes/register', {
    method: 'POST',
    body: JSON.stringify({
      nodeId: config.nodeId,
      displayName: config.displayName,
      models: config.models,
      maxConcurrentJobs: config.maxConcurrentJobs,
      publicKeyJwk: keyPair.publicKeyJwk,
    }),
  });
  console.log(`[AIOS Node] registered as ${config.nodeId}; models: ${config.models.join(', ')}`);
}

async function heartbeat() {
  await api(`/v1/nodes/${encodeURIComponent(config.nodeId)}/heartbeat`, { method: 'POST', body: '{}' });
}

async function processJob(job) {
  let decrypted;
  try {
    decrypted = decryptJob(job.envelope, keyPair.privateKeyJwk, job.id);
    if (!config.models.includes(job.model)) throw new Error('Requested model is not allow-listed on this node.');
    const tokenLimit = Math.min(job.maxTokens, config.maxTokensPerJob);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    const output = await generateWithOllama({ baseUrl: config.ollamaUrl, model: job.model, messages: decrypted.messages, maxTokens: tokenLimit, signal: controller.signal });
    clearTimeout(timeout);
    const envelope = encryptResult({ content: output, completedAt: Date.now() }, keyPair.privateKeyJwk, job.envelope.ephemeralPublicKeyJwk, job.id);
    await api(`/v1/nodes/${encodeURIComponent(config.nodeId)}/jobs/${encodeURIComponent(job.id)}/result`, { method: 'POST', body: JSON.stringify({ status: 'completed', envelope }) });
    console.log(`[AIOS Node] completed ${job.id}`);
  } catch (error) {
    const errorCode = error?.name === 'AbortError' ? 'MODEL_TIMEOUT' : 'NODE_EXECUTION_FAILED';
    console.error(`[AIOS Node] ${job.id} failed:`, error instanceof Error ? error.message : error);
    await api(`/v1/nodes/${encodeURIComponent(config.nodeId)}/jobs/${encodeURIComponent(job.id)}/result`, { method: 'POST', body: JSON.stringify({ status: 'failed', errorCode }) }).catch(() => undefined);
  }
}

async function loop() {
  for (;;) {
    try {
      const next = await api(`/v1/nodes/${encodeURIComponent(config.nodeId)}/jobs/next`);
      if (next?.job) await processJob(next.job);
      else await sleep(config.pollIntervalMs);
    } catch (error) {
      console.error('[AIOS Node] poll error:', error instanceof Error ? error.message : error);
      await sleep(Math.min(config.pollIntervalMs * 3, 15_000));
    }
  }
}

await register();
setInterval(() => { void heartbeat().catch((error) => console.error('[AIOS Node] heartbeat error:', error.message)); }, config.heartbeatIntervalMs).unref();
await loop();

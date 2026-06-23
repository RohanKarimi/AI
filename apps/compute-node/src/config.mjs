import path from 'node:path';

function positiveInt(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`);
  return value;
}

const modelPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{1,127}$/;
const models = (process.env.OLLAMA_MODEL_ALLOWLIST ?? 'llama3.2:3b').split(',').map((value) => value.trim()).filter(Boolean);
if (models.length === 0 || models.some((model) => !modelPattern.test(model))) throw new Error('OLLAMA_MODEL_ALLOWLIST contains an invalid model name.');

export const config = Object.freeze({
  coordinatorUrl: (process.env.COORDINATOR_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
  nodeId: process.env.NODE_ID ?? 'aios-node-local',
  displayName: process.env.NODE_DISPLAY_NAME ?? 'Local AIOS Node',
  nodeToken: process.env.NODE_TOKEN ?? '',
  ollamaUrl: (process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
  models,
  maxConcurrentJobs: positiveInt('MAX_CONCURRENT_JOBS', 1, 1, 4),
  maxTokensPerJob: positiveInt('MAX_TOKENS_PER_JOB', 512, 16, 2048),
  pollIntervalMs: positiveInt('POLL_INTERVAL_MS', 1500, 500, 30_000),
  heartbeatIntervalMs: positiveInt('HEARTBEAT_INTERVAL_MS', 10_000, 3_000, 60_000),
  keysDir: path.resolve(process.env.KEYS_DIR ?? 'keys'),
});

if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(config.nodeId)) throw new Error('NODE_ID is invalid.');
if (config.nodeToken.length < 16) throw new Error('NODE_TOKEN must be at least 16 characters.');

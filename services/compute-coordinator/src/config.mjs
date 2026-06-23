import path from 'node:path';

function integer(name, fallback, { min, max } = {}) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    throw new Error(`Invalid ${name}.`);
  }
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());
}

export const config = Object.freeze({
  host: process.env.HOST ?? '127.0.0.1',
  port: integer('PORT', 8787, { min: 1, max: 65535 }),
  dataDir: path.resolve(process.env.DATA_DIR ?? '.data'),
  corsOrigin: (process.env.CORS_ORIGIN ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  devAllowNodeRegistration: bool('DEV_ALLOW_NODE_REGISTRATION', false),
  allowAnonymousRequests: bool('ALLOW_ANONYMOUS_REQUESTS', false),
  nodeBootstrapToken: process.env.NODE_BOOTSTRAP_TOKEN ?? '',
  heartbeatTtlMs: integer('NODE_HEARTBEAT_TTL_MS', 45_000, { min: 10_000, max: 300_000 }),
  maxPromptEnvelopeBytes: integer('MAX_PROMPT_ENVELOPE_BYTES', 65_536, { min: 1_024, max: 1_000_000 }),
  maxJobTokens: integer('MAX_JOB_TOKENS', 1_024, { min: 16, max: 8_192 }),
  maxJobsPerMinutePerIp: integer('MAX_JOBS_PER_MINUTE_PER_IP', 6, { min: 1, max: 120 }),
});

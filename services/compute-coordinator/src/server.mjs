import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { requireNodeAuth, requireRequesterAuth } from './auth.mjs';
import { JsonStore } from './store.mjs';
import { assert, isUuid, validateJob, validateNodeRegistration, validateResult } from './validation.mjs';

const store = new JsonStore(config.dataDir);
await store.init();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.maxPromptEnvelopeBytes * 3 });
await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.corsOrigin.length === 0 || config.corsOrigin.includes(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Node-Id', 'X-Node-Token'],
});

const rateBuckets = new Map();
function rateLimit(request) {
  const ip = request.ip ?? 'unknown';
  const now = Date.now();
  const current = rateBuckets.get(ip) ?? [];
  const recent = current.filter((timestamp) => now - timestamp < 60_000);
  assert(recent.length < config.maxJobsPerMinutePerIp, 'Too many requests. Try again shortly.', 429);
  recent.push(now);
  rateBuckets.set(ip, recent);
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    model: job.model,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    resultEnvelope: job.resultEnvelope ?? null,
    errorCode: job.errorCode ?? null,
  };
}

app.get('/v1/health', async () => ({ status: 'ok', service: 'aios-compute-coordinator', timestamp: new Date().toISOString() }));

app.get('/v1/nodes', async (request) => {
  const model = typeof request.query?.model === 'string' ? request.query.model : undefined;
  return { nodes: store.publicNodes(Date.now(), config.heartbeatTtlMs, model) };
});

app.post('/v1/nodes/register', async (request, reply) => {
  requireNodeAuth(request, config, String(request.body?.nodeId ?? ''));
  validateNodeRegistration(request.body);
  const now = Date.now();
  const body = request.body;
  const node = await store.upsertNode({
    id: body.nodeId,
    displayName: body.displayName,
    models: [...new Set(body.models)].sort(),
    maxConcurrentJobs: body.maxConcurrentJobs,
    publicKeyJwk: body.publicKeyJwk,
    lastHeartbeatAt: now,
    createdAt: store.getNode(body.nodeId)?.createdAt ?? now,
  });
  reply.code(201);
  return { node: { id: node.id, status: node.status, heartbeatTtlMs: config.heartbeatTtlMs } };
});

app.post('/v1/nodes/:nodeId/heartbeat', async (request) => {
  const nodeId = String(request.params.nodeId ?? '');
  requireNodeAuth(request, config, nodeId);
  const node = await store.heartbeat(nodeId, Date.now());
  assert(node, 'Node is not registered.', 404);
  return { status: 'ok', queuedJobs: Object.values(store.state.jobs).filter((job) => job.targetNodeId === nodeId && job.status === 'queued').length };
});

app.get('/v1/nodes/:nodeId/jobs/next', async (request, reply) => {
  const nodeId = String(request.params.nodeId ?? '');
  requireNodeAuth(request, config, nodeId);
  const job = await store.claimNextJob(nodeId, Date.now(), config.heartbeatTtlMs);
  if (!job) {
    reply.code(204);
    return;
  }
  return {
    job: {
      id: job.id,
      model: job.model,
      maxTokens: job.maxTokens,
      envelope: job.envelope,
      createdAt: job.createdAt,
    },
  };
});

app.post('/v1/jobs', async (request, reply) => {
  requireRequesterAuth(request, config);
  rateLimit(request);
  validateJob(request.body, config.maxPromptEnvelopeBytes, config.maxJobTokens);
  const body = request.body;
  assert(!store.getJob(body.id), 'Job id already exists.', 409);
  const node = store.getNode(body.targetNodeId);
  assert(node, 'Selected provider is no longer available.', 404);
  assert(Date.now() - node.lastHeartbeatAt <= config.heartbeatTtlMs && node.status === 'active', 'Selected provider is offline.', 409);
  assert(node.models.includes(body.model), 'Selected provider does not allow this model.', 409);
  assert(node.runningJobs < node.maxConcurrentJobs, 'Selected provider is at capacity.', 409);
  const job = await store.createJob({
    id: body.id || randomUUID(),
    requesterFingerprint: request.ip ?? 'unknown',
    targetNodeId: body.targetNodeId,
    model: body.model,
    maxTokens: body.maxTokens,
    envelope: body.envelope,
    status: 'queued',
    createdAt: Date.now(),
  });
  reply.code(202);
  return { job: publicJob(job) };
});

app.get('/v1/jobs/:jobId', async (request) => {
  const jobId = String(request.params.jobId ?? '');
  assert(isUuid(jobId), 'Invalid job id.');
  const job = store.getJob(jobId);
  assert(job, 'Job not found.', 404);
  return { job: publicJob(job) };
});

app.post('/v1/nodes/:nodeId/jobs/:jobId/result', async (request) => {
  const nodeId = String(request.params.nodeId ?? '');
  const jobId = String(request.params.jobId ?? '');
  requireNodeAuth(request, config, nodeId);
  assert(isUuid(jobId), 'Invalid job id.');
  validateResult(request.body, config.maxPromptEnvelopeBytes);
  const job = await store.completeJob(nodeId, jobId, request.body, Date.now());
  assert(job, 'Job not found or does not belong to this node.', 404);
  return { job: publicJob(job) };
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  request.log[statusCode >= 500 ? 'error' : 'warn']({ err: error }, 'Request failed');
  reply.code(statusCode).send({ error: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED', message: statusCode >= 500 ? 'Unexpected coordinator error.' : error.message });
});

setInterval(() => { void store.expireJobs(Date.now(), 10 * 60_000); }, 30_000).unref();

await app.listen({ host: config.host, port: config.port });

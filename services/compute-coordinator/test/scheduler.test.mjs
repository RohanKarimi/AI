import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { JsonStore } from '../src/store.mjs';

test('claims only one queued job when a provider allows one concurrent job', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aios-coordinator-'));
  const store = new JsonStore(dataDir);
  await store.init();
  const now = Date.now();
  await store.upsertNode({ id: 'node-001', displayName: 'Test Node', models: ['llama3.2:3b'], maxConcurrentJobs: 1, publicKeyJwk: { kty: 'EC', crv: 'P-256' }, lastHeartbeatAt: now, createdAt: now });
  await store.createJob({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', targetNodeId: 'node-001', model: 'llama3.2:3b', envelope: {}, status: 'queued', createdAt: now });
  const first = await store.claimNextJob('node-001', now + 1, 60_000);
  const second = await store.claimNextJob('node-001', now + 2, 60_000);
  assert.equal(first?.status, 'running');
  assert.equal(second, null);
});

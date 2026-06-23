import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const emptyState = () => ({ version: 1, nodes: {}, jobs: {} });

export class JsonStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, 'state.json');
    this.state = emptyState();
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const text = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text);
      if (parsed && parsed.version === 1 && parsed.nodes && parsed.jobs) this.state = parsed;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.persist();
    }
  }

  async persist() {
    const snapshot = JSON.stringify(this.state);
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(tempPath, snapshot, { mode: 0o600 });
      await rename(tempPath, this.filePath);
    });
    return this.writeQueue;
  }

  activeNodes(now, ttlMs) {
    return Object.values(this.state.nodes).filter((node) => now - node.lastHeartbeatAt <= ttlMs && node.status === 'active');
  }

  publicNodes(now, ttlMs, requestedModel) {
    return this.activeNodes(now, ttlMs)
      .filter((node) => !requestedModel || node.models.includes(requestedModel))
      .map((node) => ({
        id: node.id,
        displayName: node.displayName,
        models: node.models,
        maxConcurrentJobs: node.maxConcurrentJobs,
        runningJobs: node.runningJobs,
        publicKeyJwk: node.publicKeyJwk,
        updatedAt: node.lastHeartbeatAt,
      }));
  }

  getNode(id) { return this.state.nodes[id] ?? null; }
  getJob(id) { return this.state.jobs[id] ?? null; }

  async upsertNode(node) {
    const previous = this.state.nodes[node.id];
    this.state.nodes[node.id] = {
      ...previous,
      ...node,
      status: 'active',
      runningJobs: previous?.runningJobs ?? 0,
    };
    await this.persist();
    return this.state.nodes[node.id];
  }

  async heartbeat(nodeId, now) {
    const node = this.getNode(nodeId);
    if (!node) return null;
    node.lastHeartbeatAt = now;
    node.status = 'active';
    await this.persist();
    return node;
  }

  async createJob(job) {
    this.state.jobs[job.id] = job;
    await this.persist();
    return job;
  }

  async claimNextJob(nodeId, now, ttlMs) {
    const node = this.getNode(nodeId);
    if (!node || now - node.lastHeartbeatAt > ttlMs || node.status !== 'active') return null;
    if (node.runningJobs >= node.maxConcurrentJobs) return null;
    const next = Object.values(this.state.jobs)
      .filter((job) => job.targetNodeId === nodeId && job.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!next) return null;
    next.status = 'running';
    next.startedAt = now;
    node.runningJobs += 1;
    await this.persist();
    return next;
  }

  async completeJob(nodeId, jobId, result, now) {
    const node = this.getNode(nodeId);
    const job = this.getJob(jobId);
    if (!node || !job || job.targetNodeId !== nodeId) return null;
    if (!['queued', 'running'].includes(job.status)) return job;
    job.status = result.status;
    job.finishedAt = now;
    job.resultEnvelope = result.envelope ?? null;
    job.errorCode = result.errorCode ?? null;
    node.runningJobs = Math.max(0, node.runningJobs - 1);
    await this.persist();
    return job;
  }

  async expireJobs(now, timeoutMs) {
    let changed = false;
    for (const job of Object.values(this.state.jobs)) {
      if (['queued', 'running'].includes(job.status) && now - job.createdAt > timeoutMs) {
        job.status = 'failed';
        job.finishedAt = now;
        job.errorCode = 'JOB_TIMEOUT';
        const node = this.getNode(job.targetNodeId);
        if (node && job.startedAt) node.runningJobs = Math.max(0, node.runningJobs - 1);
        changed = true;
      }
    }
    if (changed) await this.persist();
  }
}

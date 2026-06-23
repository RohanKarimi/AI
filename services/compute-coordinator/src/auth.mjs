import { timingSafeEqual } from 'node:crypto';
import { assert } from './validation.mjs';

function equal(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireNodeAuth(request, config, nodeId) {
  const token = request.headers['x-node-token'];
  assert(typeof token === 'string' && token.length >= 16, 'Missing node authentication.', 401);
  if (config.devAllowNodeRegistration) return;
  assert(config.nodeBootstrapToken.length >= 16 && equal(token, config.nodeBootstrapToken), 'Invalid node authentication.', 401);
  const headerNodeId = request.headers['x-node-id'];
  assert(headerNodeId === nodeId, 'Node identity mismatch.', 403);
}

export function requireRequesterAuth(request, config) {
  if (config.allowAnonymousRequests) return;
  const token = request.headers.authorization;
  assert(typeof token === 'string' && token.startsWith('Bearer ') && token.length > 24, 'Requester authentication is required.', 401);
  // Identity integration belongs to the product auth service. Never treat a browser-embedded API key as authentication.
}

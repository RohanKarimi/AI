const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NODE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/;
const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{1,127}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function assert(condition, message, statusCode = 400) {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }
}

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function validateNodeRegistration(body) {
  assert(body && typeof body === 'object', 'Body must be an object.');
  assert(typeof body.nodeId === 'string' && NODE_ID.test(body.nodeId), 'Invalid nodeId.');
  assert(typeof body.displayName === 'string' && body.displayName.length >= 2 && body.displayName.length <= 80, 'Invalid displayName.');
  assert(Array.isArray(body.models) && body.models.length > 0 && body.models.length <= 12, 'At least one and at most twelve models are required.');
  for (const model of body.models) assert(typeof model === 'string' && MODEL_ID.test(model), 'Invalid model identifier.');
  assert(Number.isInteger(body.maxConcurrentJobs) && body.maxConcurrentJobs >= 1 && body.maxConcurrentJobs <= 4, 'maxConcurrentJobs must be between 1 and 4.');
  assert(body.publicKeyJwk && typeof body.publicKeyJwk === 'object' && body.publicKeyJwk.kty === 'EC' && body.publicKeyJwk.crv === 'P-256', 'A P-256 public key is required.');
}

export function validateJob(body, maxEnvelopeBytes, maxJobTokens) {
  assert(body && typeof body === 'object', 'Body must be an object.');
  assert(isUuid(body.id), 'Job id must be a UUID.');
  assert(typeof body.targetNodeId === 'string' && NODE_ID.test(body.targetNodeId), 'Invalid targetNodeId.');
  assert(typeof body.model === 'string' && MODEL_ID.test(body.model), 'Invalid model.');
  assert(Number.isInteger(body.maxTokens) && body.maxTokens >= 16 && body.maxTokens <= maxJobTokens, `maxTokens must be between 16 and ${maxJobTokens}.`);
  assert(body.envelope && typeof body.envelope === 'object', 'Encrypted envelope is required.');
  const { ephemeralPublicKeyJwk, salt, iv, ciphertext } = body.envelope;
  assert(ephemeralPublicKeyJwk && ephemeralPublicKeyJwk.kty === 'EC' && ephemeralPublicKeyJwk.crv === 'P-256', 'Invalid ephemeral P-256 key.');
  for (const [name, value] of Object.entries({ salt, iv, ciphertext })) {
    assert(typeof value === 'string' && BASE64.test(value), `Invalid ${name}.`);
  }
  const envelopeBytes = Buffer.byteLength(`${salt}${iv}${ciphertext}`, 'utf8');
  assert(envelopeBytes <= maxEnvelopeBytes, 'Encrypted request is too large.', 413);
}

export function validateResult(body, maxEnvelopeBytes) {
  assert(body && typeof body === 'object', 'Body must be an object.');
  assert(['completed', 'failed'].includes(body.status), 'Invalid result status.');
  if (body.status === 'completed') {
    assert(body.envelope && typeof body.envelope === 'object', 'Encrypted result envelope is required.');
    for (const [name, value] of Object.entries({ salt: body.envelope.salt, iv: body.envelope.iv, ciphertext: body.envelope.ciphertext })) {
      assert(typeof value === 'string' && BASE64.test(value), `Invalid encrypted result ${name}.`);
    }
    assert(Buffer.byteLength(`${body.envelope.salt}${body.envelope.iv}${body.envelope.ciphertext}`, 'utf8') <= maxEnvelopeBytes * 2, 'Encrypted result is too large.', 413);
  }
  if (body.status === 'failed') {
    assert(typeof body.errorCode === 'string' && /^[A-Z0-9_]{3,64}$/.test(body.errorCode), 'Invalid errorCode.');
  }
}

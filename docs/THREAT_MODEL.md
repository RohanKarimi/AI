# Threat Model Summary

## Assets

- Requester prompt/result content
- Provider host integrity and local Ollama endpoint
- Coordinator queue integrity and provider availability
- Node private ECDH key and temporary requester ephemeral key

## Trust boundaries

1. **Requester browser → Coordinator:** ciphertext and metadata cross a network boundary.
2. **Coordinator → Node Agent:** ciphertext crosses a network boundary.
3. **Node Agent → local Ollama:** plaintext is intentionally exposed only on the provider host loopback path.
4. **Browser local storage:** chat/model cache is controlled by the requester browser profile.

## Important threats and mitigations

| Threat | Mitigation in repository | Required before public launch |
|---|---|---|
| Coordinator reads prompt/output | E2E envelope encryption | External crypto review, key/version rotation |
| Provider runs arbitrary user code | Node accepts bounded chat payload only | Signed job schemas, process sandboxing |
| Malicious provider reads prompts | UI warning; voluntary selection | Provider verification/reputation/attestation |
| Node agent leaked private key | Owner-only file mode | OS keychain/TPM storage + rotation/revocation |
| Queue flooding | In-memory IP limiter | Auth, Redis limits, bot defense, quotas |
| Coordinator restart loses work | JSON persistence | PostgreSQL/Redis durable queue + idempotency |
| Model abuse | Model allow-list/token caps | Policy engine, monitoring and incident response |
| WebRTC/IP privacy issues | Protocol does not require peer-to-peer connections | Privacy review if future WebRTC/TURN is added |

# AIOS Community Compute Protocol

## Purpose

Allow a requester to borrow bounded text-generation capacity from a voluntary provider without exposing either party to unrestricted machine access.

## Explicit non-goals

- Remote desktop, SSH, shell command execution, browser automation or VM hosting
- Arbitrary executable, JavaScript, Python, Docker, WASM or model-upload jobs
- File transfer, microphone/camera access, local network access or disk access
- Background task execution after a provider stops the Node Agent
- Cryptocurrency rewards, mining workloads or settlement

## Components

```text
Requester browser
  │  encrypted task envelope (P-256 ECDH + HKDF + AES-256-GCM)
  ▼
Coordinator
  ├─ validates metadata, rate limits, stores ciphertext, schedules bounded job
  ▼
Voluntary AIOS Node Agent
  ├─ decrypts prompt only in host memory
  ├─ checks allow-listed Ollama model and token cap
  ├─ calls its own local Ollama endpoint
  └─ encrypts result for requester browser
```

## Request lifecycle

1. Provider starts the Node Agent manually and it creates an ECDH P-256 keypair stored on the host with owner-only permissions.
2. Node registers only its display name, model allow-list, capacity and public key with the Coordinator.
3. Requester chooses Community Compute explicitly in the web application.
4. Browser discovers only active nodes that offer the selected `networkModelId`.
5. Browser creates an ephemeral P-256 keypair, derives a shared secret with the node public key, derives an AES-256-GCM key using HKDF-SHA256 with `aios-network-v1:<jobId>` as context, and encrypts the bounded chat payload.
6. Coordinator validates ciphertext size and metadata, queues the job for the selected node, and never receives plaintext prompt/result.
7. Node pulls one job, decrypts in memory, validates message cardinality/length and model allow-list, then invokes local Ollama with `stream:false` and a hard output token cap.
8. Node encrypts the response using the same ECDH relationship, but a new salt/IV, and submits ciphertext to Coordinator.
9. Requester browser polls the job, decrypts the result locally, and discards its ephemeral private key.

## Security properties

| Property | Included | Limit |
|---|---|---|
| TLS transport | Required in production | Local development can use `http://localhost` only |
| Prompt/result confidentiality from Coordinator | Yes, envelope encryption | Coordinator still sees timing, selected model and ciphertext size |
| Provider identity | Not yet | Production needs verified identities and reputation |
| Provider sees prompt | Yes, in RAM while generating | Requesters must not send secrets/private documents |
| Arbitrary code prevention | Yes | Only bounded chat payload accepted by Node Agent |
| Node CPU/GPU control | Partial | Provider controls process lifetime, model allow-list, max tokens/concurrency |
| Abuse resistance | Development rate limit | Production needs Redis/global limits, user auth, moderation and operations |

## Required deployment hardening

- HTTPS with HSTS, strict CORS allow-list, valid origin checks and CSRF controls where cookie auth is used.
- Replace JSON state file with Postgres transaction storage plus Redis/BullMQ or equivalent durable queues.
- Provider node enrollment using device-bound credentials, certificate rotation and signed versioned releases.
- Per-user authentication, job quotas, risk controls and an immutable audit trail containing no plaintext prompts.
- Independent application and cryptography review before public network use.

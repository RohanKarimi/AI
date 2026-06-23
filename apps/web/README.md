# AIOS Web Application

This React/Vite PWA is the end-user part of AIOS Network Platform.

## Modes

- **Local only** — installs a compatible WebLLM model after explicit user action and runs inference in the browser using WebGPU.
- **Local preferred** — reserved for controlled fallback routing; remains local in this repository.
- **Community Compute** — enabled only when `VITE_COMPUTE_API_URL` is configured. It discovers voluntary provider nodes and encrypts bounded chat jobs using P-256 ECDH, HKDF-SHA256 and AES-256-GCM.

Community Compute is not remote desktop sharing. The selected provider sees the prompt in memory while its own local model runs; do not use it for secrets, credentials or sensitive documents.

## Run locally

```bash
cp .env.example .env
npm ci
npm run dev
```

Use a WebGPU-capable browser for Browser-local mode. The Community Compute API must be HTTPS outside `localhost`.

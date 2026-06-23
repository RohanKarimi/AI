# AIOS Network Platform

AIOS is a local-first AI workspace for the browser. It combines a polished React dashboard, local WebGPU model execution through WebLLM, file-aware chat workflows, an image-generation studio, and an optional Community Device protocol for bounded text generation on opted-in provider devices.

AIOS is not remote desktop software. Community Device never grants shell access, file-system access, browser control, background jobs, mining jobs, or arbitrary code execution.

## Status

This repository is release-ready as a product foundation and demo application:

- Browser UI builds successfully with Vite.
- Local chat flow works in preview mode even before a model is installed.
- Local model install/run path is wired through WebLLM/WebGPU.
- Community Device client, coordinator and provider node are included.
- Docker Compose can run the web app and coordinator.
- Error boundaries, storage fallbacks and user-facing error states are included.

Before operating a public compute marketplace, complete the production controls listed in [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md).

https://github.com/RohanKarimi/AI/blob/9afdcfef5b630120966f66a93c09b30c34a79c24/docs/image.png

## Features

- Local-first AI chat with model selection and install states.
- WebGPU device scan and compatibility scoring.
- Agents Store for everyday, work, study, QA, developer, crypto, business and private-document workflows.
- Models Store with real model IDs and AIOS-branded UI labels.
- Image Studio for local/offline image model packs and Midjourney-style prompt export.
- Files & Knowledge import with removable local file previews.
- 20-language UI shell with RTL support.
- Dark and light themes.
- Profile name/avatar editor.
- Notification, search and quick-action menus.
- Optional Community Device routing with encrypted prompt/result envelopes.
- Docker-ready web and coordinator services.

## Repository Layout

```text
apps/
  web/                  React + Vite + WebLLM browser application
  compute-node/         Opt-in provider node that talks to local Ollama
services/
  compute-coordinator/  Fastify coordinator for node registration, queues and routing
docs/
  NETWORK_PROTOCOL.md
  PRODUCTION_CHECKLIST.md
  THREAT_MODEL.md
infra/
  docker-compose.yml
```

## Requirements

- Node.js 22 or newer.
- npm.
- A WebGPU-capable browser for local model execution, such as a current Chromium-based browser.
- Docker Desktop or Docker Engine for the Compose flow.
- Ollama only if you want to run a provider node.

## Quick Start: Web App

```bash
cd apps/web
npm ci
npm run dev
```

Open the Vite URL printed in the terminal, usually:

```text
http://localhost:5173
```

The app can be used immediately in preview mode. Real local generation starts after the user installs a compatible model from Models Store.

## Build

```bash
cd apps/web
npm run check
npm run build
npm run preview
```

Root-level shortcuts:

```bash
npm run web:check
npm run web:build
npm run build
```

## Docker

From the repository root:

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

Open:

```text
http://localhost:4173
```

For LAN testing, update `.env` with your host IP:

```env
AIOS_WEB_PORT=4173
AIOS_COORDINATOR_PORT=8787
VITE_COMPUTE_API_URL=http://YOUR_LAN_IP:8787
AIOS_CORS_ORIGIN=http://YOUR_LAN_IP:4173,http://localhost:4173,http://localhost:5173
```

Then rebuild:

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Environment Variables

Root `.env.example`:

```env
AIOS_WEB_PORT=4173
AIOS_COORDINATOR_PORT=8787
VITE_COMPUTE_API_URL=http://localhost:8787
AIOS_CORS_ORIGIN=http://localhost:4173,http://localhost:5173
```

Web app:

```env
VITE_COMPUTE_API_URL=http://localhost:8787
```

Coordinator:

```env
HOST=127.0.0.1
PORT=8787
DATA_DIR=.data
CORS_ORIGIN=http://localhost:5173,http://localhost:4173
DEV_ALLOW_NODE_REGISTRATION=true
ALLOW_ANONYMOUS_REQUESTS=true
NODE_BOOTSTRAP_TOKEN=change-me-before-production
NODE_HEARTBEAT_TTL_MS=45000
MAX_PROMPT_ENVELOPE_BYTES=65536
MAX_JOB_TOKENS=1024
MAX_JOBS_PER_MINUTE_PER_IP=6
```

Provider node:

```env
COORDINATOR_URL=http://localhost:8787
NODE_ID=rohan-laptop-01
NODE_DISPLAY_NAME=Rohan's Local AI Node
NODE_TOKEN=change-me-before-production
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL_ALLOWLIST=llama3.2:3b
MAX_CONCURRENT_JOBS=1
MAX_TOKENS_PER_JOB=512
POLL_INTERVAL_MS=1500
HEARTBEAT_INTERVAL_MS=10000
KEYS_DIR=keys
```

Never commit real production tokens, private keys, logs or generated node keys.

## Community Device Local Demo

1. Start Ollama and pull a model:

```bash
ollama pull llama3.2:3b
ollama serve
```

2. Start the coordinator:

```bash
cd services/compute-coordinator
cp .env.example .env
npm ci
npm start
```

3. Start a provider node in another terminal:

```bash
cd apps/compute-node
cp .env.example .env
npm ci
npm start
```

4. Start the web app with `VITE_COMPUTE_API_URL` set:

```bash
cd apps/web
npm ci
npm run dev
```

5. Open AIOS, go to Community Device, review the safety boundary, then choose network routing.

## Real Model IDs

AIOS UI labels are branded. The real model IDs used by the project are:

### WebLLM / Local Engine IDs

```text
Qwen2.5-0.5B-Instruct-q4f16_1-MLC
Llama-3.2-1B-Instruct-q4f16_1-MLC
Qwen2.5-1.5B-Instruct-q4f16_1-MLC
SmolLM2-1.7B-Instruct-q4f16_1-MLC
Llama-3.2-3B-Instruct-q4f16_1-MLC
Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC
Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC
gemma-2-2b-it-q4f16_1-MLC
Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC
Phi-4-mini-instruct-q4f16_1-MLC
Phi-3.5-mini-instruct-q4f16_1-MLC
Mistral-7B-Instruct-v0.3-q4f16_1-MLC
Hermes-2-Pro-Mistral-7B-q4f16_1-MLC
DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC
DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC
```

### Network / Ollama-Style IDs

```text
qwen2.5:0.5b
llama3.2:1b
qwen2.5:1.5b
smollm2:1.7b
llama3.2:3b
qwen2.5-coder:1.5b
qwen2.5-math:1.5b
gemma2:2b
qwen2.5-coder:3b
phi4-mini
phi3.5:mini
mistral:7b-instruct
hermes2-pro-mistral:7b
deepseek-r1:7b
deepseek-r1:8b
```

### Image Model Options

```text
FLUX.1 Schnell
Stable Diffusion XL 1.0
Stable Diffusion 1.5
Stable Diffusion 3.5 Medium
```

Image Studio currently provides the product UI, pack metadata and prompt export flow. A production image runtime must connect the chosen local image model pack to a desktop runtime, ComfyUI, Diffusers, WebGPU image pipeline or a trusted backend.

## Security Boundaries

- Local mode is the default.
- Community Device is disabled unless `VITE_COMPUTE_API_URL` is configured and the user selects network routing.
- Prompt/result envelopes use P-256 ECDH, HKDF and AES-GCM.
- The coordinator routes ciphertext and metadata.
- The provider node can see the prompt in memory while generating.
- Provider nodes only accept bounded text-generation jobs for allow-listed models.
- Provider nodes do not accept shell commands, arbitrary code, file access, mining jobs or background tasks.

## Release Checklist

Before publishing a public release:

- Run `npm run web:check`.
- Run `npm run web:build`.
- Run `npm run coordinator:test`.
- Run `npm --prefix apps/compute-node run check`.
- Verify `.env` is ignored and no secrets are committed.
- Verify model licenses and redistribution rights.
- Use HTTPS for public Community Device deployments.
- Set production CORS origins.
- Disable anonymous requester access unless you have an auth layer.
- Replace development node registration with authenticated provisioning.
- Review [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
- Review [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md).

## Troubleshooting

### Local model install fails

- Use a WebGPU-capable browser.
- Update GPU drivers.
- Check available browser storage.
- Try a smaller model.
- Confirm the first model download can reach the model hosting endpoint.

### Community Device is disabled

- Set `VITE_COMPUTE_API_URL`.
- Use HTTPS outside localhost.
- Confirm the coordinator is running.
- Confirm CORS allows the web origin.
- Confirm at least one provider node is registered with the selected model.

### Chat works only in preview mode

Install a local model from Models Store or enable Community Device. Preview mode is intentionally available so the UI remains usable before a runtime is ready.

## License and Model Governance

AIOS code and assets should be released only under the license you choose for this repository. Model weights are separate artifacts and each model requires its own license, usage, geography, trademark and redistribution review.

Do not claim a model is bundled or redistributable unless you have verified those rights.

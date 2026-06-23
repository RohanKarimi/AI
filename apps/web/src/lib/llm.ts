import type { ChatMessage, InstallStatus } from '../types';

export type LlmProgressHandler = (status: InstallStatus) => void;

type Engine = {
  chat: {
    completions: {
      create: (request: {
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        temperature?: number;
        stream?: boolean;
        stream_options?: { include_usage?: boolean };
      }) => Promise<unknown>;
    };
  };
  interruptGenerate?: () => void;
  unload?: () => Promise<void>;
};

let worker: Worker | null = null;
let engine: Engine | null = null;
let activeModelId: string | null = null;

function progressFromText(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)%/);
  return match ? Math.max(0, Math.min(100, Math.round(Number(match[1])))) : 0;
}

export function loadedModelId(): string | null {
  return activeModelId;
}

export async function loadModel(modelId: string, onProgress: LlmProgressHandler): Promise<void> {
  if (activeModelId === modelId && engine) {
    onProgress({ stage: 'ready', progress: 100, text: 'Already ready for offline use.' });
    return;
  }

  onProgress({ stage: 'downloading', progress: 0, text: 'Preparing secure local runtime...' });

  try {
    const webllm = await import('@mlc-ai/web-llm');
    worker?.terminate();
    worker = new Worker(new URL('../workers/llm.worker.ts', import.meta.url), { type: 'module' });

    const runtime = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
      appConfig: { ...webllm.prebuiltAppConfig, cacheBackend: 'cache' },
      initProgressCallback: (report: { text: string }) => {
        onProgress({ stage: 'downloading', progress: progressFromText(report.text), text: report.text });
      },
    });

    engine = runtime as unknown as Engine;
    activeModelId = modelId;
    onProgress({ stage: 'ready', progress: 100, text: 'Installed locally. This model can now run offline in this browser.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local model loading failed.';
    onProgress({ stage: 'error', progress: 0, text: 'Model installation failed.', error: message });
    throw error;
  }
}

export async function generateStreaming(
  messages: ChatMessage[],
  onToken: (content: string) => void,
): Promise<void> {
  if (!engine) throw new Error('Install a local model before running the agent.');

  const response = await engine.chat.completions.create({
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: 0.35,
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!isAsyncIterable(response)) throw new Error('The local runtime returned an unexpected response.');

  for await (const part of response) {
    const chunk = part as { choices?: Array<{ delta?: { content?: string } }> };
    const token = chunk.choices?.[0]?.delta?.content;
    if (token) onToken(token);
  }
}

export function interruptGeneration(): void {
  engine?.interruptGenerate?.();
}

export async function unloadRuntime(): Promise<void> {
  await engine?.unload?.();
  worker?.terminate();
  worker = null;
  engine = null;
  activeModelId = null;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function');
}

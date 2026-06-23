import type { DeviceProfile, DeviceTier } from '../types';

type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number };

type AdapterInfoLike = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

function browserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) return 'Google Chrome';
  if (/Firefox\//.test(userAgent)) return 'Mozilla Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  return 'Unknown browser';
}

function operatingSystem(userAgent: string): string {
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS / iPadOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Unknown operating system';
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function selectTier(score: number): DeviceTier {
  if (score >= 82) return 'advanced';
  if (score >= 62) return 'power';
  if (score >= 42) return 'balanced';
  return 'starter';
}

function buildReasons(input: {
  webgpu: boolean;
  f16: boolean;
  cores: number;
  memory: number | null;
  storage: number | null;
}): string[] {
  const reasons: string[] = [];
  if (input.webgpu) reasons.push('WebGPU is available for local GPU acceleration.');
  else reasons.push('WebGPU is not available, so local LLM execution is unavailable in this version.');
  if (input.f16) reasons.push('The GPU supports shader-f16, which unlocks more compact model builds.');
  if ((input.memory ?? 0) >= 8) reasons.push('Reported device memory is suitable for balanced local models.');
  if ((input.storage ?? 0) < 4) reasons.push('Free browser storage may be too limited for larger model downloads.');
  if (input.cores < 4) reasons.push('Lower CPU parallelism may make loading and fallback tasks slower.');
  return reasons;
}

function timeout<T>(milliseconds: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(fallback), milliseconds);
  });
}

export async function scanDevice(): Promise<DeviceProfile> {
  const navigatorWithMemory = navigator as NavigatorWithDeviceMemory;
  const cores = navigator.hardwareConcurrency || 2;
  const deviceMemoryGb = navigatorWithMemory.deviceMemory ?? null;
  const storageEstimate = await Promise.race([
    navigator.storage?.estimate?.().catch(() => undefined) ?? Promise.resolve(undefined),
    timeout<StorageEstimate | undefined>(900, undefined),
  ]);
  const storageQuotaGb = storageEstimate?.quota ? Number((storageEstimate.quota / 1024 ** 3).toFixed(1)) : null;
  const storageUsageGb = storageEstimate?.usage ? Number((storageEstimate.usage / 1024 ** 3).toFixed(2)) : null;
  const persisted = await Promise.race([
    navigator.storage?.persisted?.().catch(() => null) ?? Promise.resolve(null),
    timeout<boolean | null>(900, null),
  ]);

  let webgpuAdapterName: string | null = null;
  let maxStorageBufferBindingSizeMb: number | null = null;
  let shaderF16 = false;
  let webgpu = false;

  if (navigatorWithMemory.gpu) {
    try {
      const adapter = await Promise.race([
        navigatorWithMemory.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null),
        timeout<GPUAdapter | null>(1600, null),
      ]);
      if (adapter) {
        webgpu = true;
        shaderF16 = adapter.features.has('shader-f16');
        maxStorageBufferBindingSizeMb = Math.round(adapter.limits.maxStorageBufferBindingSize / 1024 ** 2);
        const adapterWithInfo = adapter as GPUAdapter & { info?: AdapterInfoLike };
        const info = adapterWithInfo.info;
        const text = [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(' · ');
        webgpuAdapterName = text || 'WebGPU adapter detected';
      }
    } catch {
      webgpu = false;
    }
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (webgpu ? 32 : 0) +
          (shaderF16 ? 14 : 0) +
          Math.min(16, cores * 2) +
          Math.min(18, (deviceMemoryGb ?? 4) * 2) +
          Math.min(14, (storageQuotaGb ?? 2) * 0.35) +
          (webglAvailable() ? 6 : 0),
      ),
    ),
  );

  return {
    browser: browserName(navigator.userAgent),
    operatingSystem: operatingSystem(navigator.userAgent),
    cores,
    deviceMemoryGb,
    storageQuotaGb,
    storageUsageGb,
    webgpu,
    webgl: webglAvailable(),
    webgpuAdapterName,
    maxStorageBufferBindingSizeMb,
    shaderF16,
    persistentStorage: persisted ?? null,
    score,
    tier: selectTier(score),
    reasons: buildReasons({ webgpu, f16: shaderF16, cores, memory: deviceMemoryGb, storage: storageQuotaGb }),
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist().catch(() => false);
}

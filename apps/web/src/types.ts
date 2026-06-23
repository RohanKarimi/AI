export type DeviceTier = 'starter' | 'balanced' | 'power' | 'advanced';

export type DeviceProfile = {
  browser: string;
  operatingSystem: string;
  cores: number;
  deviceMemoryGb: number | null;
  storageQuotaGb: number | null;
  storageUsageGb: number | null;
  webgpu: boolean;
  webgl: boolean;
  webgpuAdapterName: string | null;
  maxStorageBufferBindingSizeMb: number | null;
  shaderF16: boolean;
  persistentStorage: boolean | null;
  score: number;
  tier: DeviceTier;
  reasons: string[];
};

export type InstallStage = 'idle' | 'downloading' | 'ready' | 'error';

export type InstallStatus = {
  stage: InstallStage;
  progress: number;
  text: string;
  error?: string;
};

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type RuntimePreference = 'local' | 'auto' | 'network';

export type ThemeMode = 'dark' | 'light';

export type LanguageCode =
  | 'en'
  | 'fa'
  | 'ar'
  | 'es'
  | 'fr'
  | 'de'
  | 'zh'
  | 'hi'
  | 'pt'
  | 'ru'
  | 'ja'
  | 'ko'
  | 'tr'
  | 'it'
  | 'id'
  | 'ur'
  | 'bn'
  | 'vi'
  | 'th'
  | 'nl';

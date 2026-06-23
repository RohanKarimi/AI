import type { LanguageCode, ThemeMode } from '../types';

const SETTINGS_KEY = 'aios:settings:v1';
const CHAT_KEY = 'aios:chat:v1';
const LANGUAGE_CODES: LanguageCode[] = ['en', 'fa', 'ar', 'es', 'fr', 'de', 'zh', 'hi', 'pt', 'ru', 'ja', 'ko', 'tr', 'it', 'id', 'ur', 'bn', 'vi', 'th', 'nl'];
const RUNTIME_MODES = ['local', 'auto', 'network'] as const;
const THEME_MODES: ThemeMode[] = ['dark', 'light'];

export type StoredSettings = {
  selectedSkillId: string;
  selectedModelId: string | null;
  runtimePreference: 'local' | 'auto' | 'network';
  language: LanguageCode;
  themeMode: ThemeMode;
  profileName: string;
  profileAvatar: string | null;
};

export const defaultSettings: StoredSettings = {
  selectedSkillId: 'daily',
  selectedModelId: null,
  runtimePreference: 'local',
  language: 'en',
  themeMode: 'dark',
  profileName: 'AIOS User',
  profileAvatar: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeSettings(value: unknown): StoredSettings {
  if (!isRecord(value)) return defaultSettings;
  return {
    selectedSkillId: typeof value.selectedSkillId === 'string' && value.selectedSkillId ? value.selectedSkillId : defaultSettings.selectedSkillId,
    selectedModelId: typeof value.selectedModelId === 'string' ? value.selectedModelId : null,
    runtimePreference: RUNTIME_MODES.includes(value.runtimePreference as StoredSettings['runtimePreference'])
      ? value.runtimePreference as StoredSettings['runtimePreference']
      : defaultSettings.runtimePreference,
    language: LANGUAGE_CODES.includes(value.language as LanguageCode) ? value.language as LanguageCode : defaultSettings.language,
    themeMode: THEME_MODES.includes(value.themeMode as ThemeMode) ? value.themeMode as ThemeMode : defaultSettings.themeMode,
    profileName: typeof value.profileName === 'string' && value.profileName.trim() ? value.profileName : defaultSettings.profileName,
    profileAvatar: typeof value.profileAvatar === 'string' && value.profileAvatar.startsWith('data:image/') ? value.profileAvatar : null,
  };
}

export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: StoredSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadChat<T>(): T | null {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveChat<T>(messages: T): boolean {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    return true;
  } catch {
    return false;
  }
}

export async function clearBrowserAIData(): Promise<void> {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(CHAT_KEY);
  } catch {
    // Browsers can deny storage access in strict privacy modes.
  }
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => /webllm|mlc|aios/i.test(name)).map((name) => caches.delete(name)));
  }
}

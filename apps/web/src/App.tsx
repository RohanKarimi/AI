import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  BrainCircuit,
  Briefcase,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  Code2,
  Cpu,
  Database,
  FileText,
  Globe2,
  GraduationCap,
  HardDrive,
  Home,
  Image,
  MessageCircle,
  Mic,
  Moon,
  Network,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { findModel, isModelSuitable, MODEL_CATALOG, SKILL_CATALOG, type ModelDefinition } from './data/catalog';
import { requestPersistentStorage, scanDevice } from './lib/device';
import { LANGUAGES, languageInfoFor, translate, type UiKey } from './i18n';
import { generateStreaming, interruptGeneration, loadModel, loadedModelId, unloadRuntime } from './lib/llm';
import { networkComputeConfigured, submitNetworkChat } from './lib/networkCompute';
import { clearBrowserAIData, loadChat, loadSettings, saveChat, saveSettings } from './lib/storage';
import type { ChatMessage, DeviceProfile, InstallStatus, LanguageCode, RuntimePreference, ThemeMode } from './types';

const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
type View = 'home' | 'chat' | 'agents' | 'models' | 'image' | 'compute' | 'files' | 'history' | 'settings';
const VIEW_IDS = new Set<View>(['home', 'chat', 'agents', 'models', 'image', 'compute', 'files', 'history', 'settings']);
const AIOS_ICON_BASE = '/media/aios-icons/glass-card/512';
const aiosIcon = (name: string) => `${AIOS_ICON_BASE}/${name}.png`;

function viewFromHash(): View {
  if (typeof window === 'undefined') return 'home';
  const value = window.location.hash.replace(/^#/, '');
  if (value === 'top' || value === '') return 'home';
  return VIEW_IDS.has(value as View) ? value as View : 'home';
}

function formatGb(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Not exposed';
  return value >= 10 ? `${Math.round(value)} GB` : `${value.toFixed(1)} GB`;
}

function uniqueModels(models: Array<ModelDefinition | null | undefined>): ModelDefinition[] {
  const seen = new Set<string>();
  return models.filter((model): model is ModelDefinition => {
    if (!model || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

const AGENT_VISUALS: Record<string, { icon: LucideIcon; iconSrc: string; tone: string; badge: string; installs: string; version: string }> = {
  daily: { icon: Sparkles, iconSrc: aiosIcon('daily-life'), tone: 'violet', badge: 'Lifestyle', installs: '18.4K', version: 'v2.4' },
  worker: { icon: Briefcase, iconSrc: aiosIcon('business'), tone: 'blue', badge: 'Productivity', installs: '12.1K', version: 'v3.0' },
  student: { icon: GraduationCap, iconSrc: aiosIcon('student'), tone: 'cyan', badge: 'Learning', installs: '9.8K', version: 'v2.2' },
  qa: { icon: ShieldCheck, iconSrc: aiosIcon('qa-engineer'), tone: 'green', badge: 'Engineering', installs: '6.7K', version: 'v1.9' },
  developer: { icon: Code2, iconSrc: aiosIcon('developer'), tone: 'blue', badge: 'Developer', installs: '21.6K', version: 'v4.1' },
  crypto: { icon: ChartNoAxesCombined, iconSrc: aiosIcon('crypto-trader'), tone: 'orange', badge: 'Research', installs: '5.2K', version: 'v1.7' },
  business: { icon: Store, iconSrc: aiosIcon('marketplace'), tone: 'purple', badge: 'Business', installs: '7.3K', version: 'v2.0' },
  'private-docs': { icon: FileText, iconSrc: aiosIcon('rag-knowledge'), tone: 'green', badge: 'Privacy', installs: '10.5K', version: 'v3.5' },
};

const IMAGE_MODEL_CATALOG = [
  {
    id: 'flux-schnell',
    name: 'AIOS Flux Schnell',
    base: 'FLUX.1 Schnell',
    badge: 'Best quality',
    iconSrc: aiosIcon('image-generation'),
    tone: 'cyan',
    license: 'Apache 2.0',
    size: '23 GB pack',
    memory: '12 GB+ VRAM recommended',
    speed: '1-4 step generation',
    mode: 'Offline + commercial friendly',
    description: 'The premium local image model slot for cinematic, Midjourney-like artwork, clean lighting and strong prompt following.',
    prompt: 'cinematic AI operating system command center, glowing neural interface, volumetric light, ultra detailed, elegant, futuristic, 35mm',
  },
  {
    id: 'sdxl-pro',
    name: 'AIOS SDXL Pro',
    base: 'Stable Diffusion XL 1.0',
    badge: 'Creator default',
    iconSrc: aiosIcon('install'),
    tone: 'violet',
    license: 'OpenRAIL++',
    size: '7 GB pack',
    memory: '8 GB+ VRAM recommended',
    speed: 'High-control workflow',
    mode: 'Offline + LoRA ecosystem',
    description: 'Balanced local studio model with excellent LoRA support, style control, image-to-image workflows and reliable 1024px outputs.',
    prompt: 'high-end product poster for an AI desktop app, glassmorphism UI, neon accents, sharp typography, studio lighting, premium tech brand',
  },
  {
    id: 'sd15-lite',
    name: 'AIOS Lite SD 1.5',
    base: 'Stable Diffusion 1.5',
    badge: 'Low device',
    iconSrc: aiosIcon('offline'),
    tone: 'green',
    license: 'OpenRAIL-M',
    size: '4 GB pack',
    memory: '4-6 GB VRAM friendly',
    speed: 'Fast on older GPUs',
    mode: 'Offline + lightweight',
    description: 'A lightweight image model for laptops and older devices. Great for stylized art, thumbnails and fast offline experiments.',
    prompt: 'beautiful cyberpunk portrait, soft rim light, detailed face, teal and purple palette, sharp focus, artstation quality',
  },
  {
    id: 'sd35-medium',
    name: 'AIOS SD 3.5 Medium',
    base: 'Stable Diffusion 3.5 Medium',
    badge: 'Modern prompt',
    iconSrc: aiosIcon('target'),
    tone: 'orange',
    license: 'Community License',
    size: '10 GB pack',
    memory: '8-12 GB VRAM recommended',
    speed: 'Improved typography',
    mode: 'Offline + revenue-aware',
    description: 'Modern prompt understanding with stronger text rendering and composition. Good for posters, UI mockups and brand concepts.',
    prompt: 'AIOS image studio dashboard, clean text labels, premium dark UI, generated artwork grid, modern SaaS, cinematic neon glow',
  },
] as const;

function agentVisualFor(id: string) {
  return AGENT_VISUALS[id] ?? { icon: Bot, iconSrc: aiosIcon('agents'), tone: 'cyan', badge: 'AIOS', installs: 'New', version: 'v1.0' };
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) ?? 'AU');
  return letters.toUpperCase();
}

function generatedAvatar(name: string, colorA: string, colorB: string): string {
  const initials = initialsFor(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient></defs><rect width="128" height="128" rx="32" fill="url(#g)"/><text x="64" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function FlagMark({ code }: { code: string }) {
  return <span className={`flag-mark flag-${code}`} aria-hidden="true" />;
}

function previewReplyFor(content: string, skillName: string, modelName?: string): string {
  const trimmed = content.trim();
  return [
    `Preview reply from ${skillName}.`,
    '',
    `I received: "${trimmed.slice(0, 220)}${trimmed.length > 220 ? '...' : ''}"`,
    '',
    'This workspace is currently in AIOS Preview Mode because no local model is ready yet. To get real AI generation, install the selected local model or enable Community Device.',
    '',
    `Recommended next step: click "Install ${modelName ?? 'the selected AIOS model'}" above, then send again. Your chat UI, prompts and history are already working.`,
  ].join('\n');
}

export default function App() {
  const bootSettings = useMemo(() => loadSettings(), []);
  const [activeView, setActiveViewState] = useState<View>(() => viewFromHash());
  const [device, setDevice] = useState<DeviceProfile | null>(null);
  const [scanning, setScanning] = useState(true);
  const [selectedSkillId, setSelectedSkillId] = useState(bootSettings.selectedSkillId);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(bootSettings.selectedModelId);
  const [runtimePreference, setRuntimePreference] = useState<RuntimePreference>(bootSettings.runtimePreference);
  const [statuses, setStatuses] = useState<Record<string, InstallStatus | undefined>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat<ChatMessage[]>() ?? []);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [knowledgeFiles, setKnowledgeFiles] = useState<Array<{ id: string; name: string; size: string; preview: string }>>([]);
  const [language, setLanguage] = useState<LanguageCode>(bootSettings.language);
  const [themeMode, setThemeMode] = useState<ThemeMode>(bootSettings.themeMode);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(bootSettings.profileName);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(bootSettings.profileAvatar);
  const networkAbortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const languageRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const heroArtRef = useRef<HTMLDivElement | null>(null);
  const storageWarningShownRef = useRef(false);

  const networkEnabled = networkComputeConfigured();
  const currentLanguage = languageInfoFor(language);
  const t = (key: UiKey) => translate(language, key);
  const effectiveRuntime = runtimePreference === 'network' && networkEnabled ? 'network' : 'local';
  const selectedSkill = SKILL_CATALOG.find((skill) => skill.id === selectedSkillId) ?? SKILL_CATALOG[0];
  const compatibleModels = useMemo(() => {
    if (!device) return MODEL_CATALOG;
    return MODEL_CATALOG.filter((model) => isModelSuitable(model, device.tier, device.shaderF16));
  }, [device]);
  const recommendedModel = useMemo(() => {
    const preferred = selectedSkill.modelPriorities.map(findModel).find((model) => model && compatibleModels.some((item) => item.id === model.id));
    return preferred ?? compatibleModels[0] ?? null;
  }, [compatibleModels, selectedSkill]);
  const selectedModel = useMemo(() => findModel(selectedModelId ?? '') ?? recommendedModel, [recommendedModel, selectedModelId]);
  const selectedStatus = selectedModel ? statuses[selectedModel.id] : undefined;
  const localRuntimeReady = Boolean(selectedModel && loadedModelId() === selectedModel.engineModelId && selectedStatus?.stage === 'ready');
  const runtimeReady = effectiveRuntime === 'network' || localRuntimeReady;
  const displayModels = useMemo(() => uniqueModels([recommendedModel, ...MODEL_CATALOG]).slice(0, 3), [recommendedModel]);
  const visibleMessages = messages.filter((message) => message.role !== 'system');

  useEffect(() => {
    void refreshDevice();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
    return () => networkAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const saved = saveSettings({ selectedSkillId, selectedModelId, runtimePreference, language, themeMode, profileName, profileAvatar });
    if (!saved && !storageWarningShownRef.current) {
      storageWarningShownRef.current = true;
      setNotice('AIOS could not save settings in this browser. Check private mode, storage permissions or available disk space.');
    }
  }, [selectedSkillId, selectedModelId, runtimePreference, language, themeMode, profileName, profileAvatar]);
  useEffect(() => {
    const saved = saveChat(messages);
    if (!saved && messages.length > 0 && !storageWarningShownRef.current) {
      storageWarningShownRef.current = true;
      setNotice('AIOS could not save chat history in this browser. The current session still works, but history may not persist.');
    }
  }, [messages]);
  useEffect(() => {
    document.documentElement.lang = currentLanguage.code;
    document.documentElement.dir = currentLanguage.dir;
    document.documentElement.dataset.theme = themeMode;
  }, [currentLanguage.code, currentLanguage.dir, themeMode]);
  useEffect(() => {
    const syncHash = () => setActiveViewState(viewFromHash());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setLanguageMenuOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) setSearchOpen(false);
      if (languageRef.current && !languageRef.current.contains(target)) setLanguageMenuOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(target)) setNotificationsOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : 'Unexpected background error.';
      setNotice(`Background task failed: ${message}`);
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);

  function setActiveView(view: View): void {
    setActiveViewState(view);
    const nextHash = view === 'home' ? '#top' : `#${view}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
  }

  async function refreshDevice(): Promise<void> {
    setScanning(true);
    try {
      setDevice(await scanDevice());
    } catch (error) {
      setNotice(error instanceof Error ? `Device scan failed: ${error.message}` : 'Device scan failed. You can still use AIOS in preview mode.');
    } finally {
      setScanning(false);
    }
  }

  function selectSkill(id: string): void {
    setSelectedSkillId(id);
    setActiveView('chat');
  }

  function launchSkill(id: string, prompt?: string): void {
    setSelectedSkillId(id);
    if (prompt) setDraft(prompt);
    setActiveView('chat');
  }

  function selectModel(id: string): void {
    setSelectedModelId(id);
    setActiveView('models');
  }

  async function importKnowledgeFiles(fileList: FileList | null): Promise<void> {
    const files = Array.from(fileList ?? []).slice(0, 6);
    if (files.length === 0) return;
    const readablePattern = /\.(txt|md|csv|json|js|jsx|ts|tsx|css|html|py|rs|go|java|php|sol|yaml|yml|log)$/i;
    const imported = await Promise.all(files.map(async (file) => {
      const canPreview = file.type.startsWith('text/') || readablePattern.test(file.name);
      let preview = 'Binary file imported as metadata only. Keep confidential files in local mode.';
      if (canPreview) {
        try {
          preview = (await file.text()).slice(0, 420).trim() || 'No readable text found in this file.';
        } catch {
          preview = 'AIOS could not read this file preview. The file name and size were still added.';
        }
      }
      return {
        id: makeId(),
        name: file.name,
        size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
        preview,
      };
    }));
    setKnowledgeFiles((current) => [...imported, ...current].slice(0, 10));
    setNotice(`${imported.length} local file${imported.length > 1 ? 's' : ''} added to Files & Knowledge.`);
  }

  function removeKnowledgeFile(id: string): void {
    setKnowledgeFiles((current) => current.filter((file) => file.id !== id));
  }

  function clearKnowledgeFiles(): void {
    setKnowledgeFiles([]);
  }

  async function uploadAvatar(fileList: FileList | null): Promise<void> {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Please choose a PNG, JPG, GIF or WebP image for the avatar.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Avatar image is too large. Please choose an image under 2 MB.');
      return;
    }
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setProfileAvatar(dataUrl);
      setNotice('Profile avatar updated.');
    } catch {
      setNotice('AIOS could not read that avatar image. Try another file.');
    }
  }

  async function install(modelId: string): Promise<void> {
    const model = findModel(modelId);
    if (!model) return;
    setSelectedModelId(model.id);
    setNotice(null);
    try {
      await loadModel(model.engineModelId, (status) => setStatuses((current) => ({ ...current, [model.id]: status })));
      setNotice(`${model.name} is ready for local offline use in this browser.`);
    } catch (error) {
      const detail = error instanceof Error && error.message ? ` Detail: ${error.message}` : '';
      setNotice(`AIOS could not install ${model.name}. Check browser WebGPU support, free storage, network access for the first download, and model compatibility.${detail}`);
    }
  }

  async function send(content: string): Promise<void> {
    if (!selectedModel || generating) return;
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content, createdAt: Date.now() };
    const assistantId = makeId();
    const assistantMessage: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() };
    const runMessages: ChatMessage[] = [
      { id: 'system', role: 'system', content: `${selectedSkill.systemPrompt}\n\nAnswer in ${currentLanguage.englishName} unless the user explicitly asks for another language. ${selectedSkill.safetyNote ? `Safety note: ${selectedSkill.safetyNote}` : ''}`, createdAt: Date.now() },
      ...messages.slice(-18),
      userMessage,
    ];
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setGenerating(true);
    setNetworkStatus(null);
    try {
      if (effectiveRuntime === 'network') {
        if (!selectedModel.networkModelId) throw new Error('The selected model is not mapped to a permitted Community Device route.');
        const controller = new AbortController();
        networkAbortRef.current = controller;
        const output = await submitNetworkChat({
          model: selectedModel.networkModelId,
          messages: runMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          maxTokens: 512,
          signal: controller.signal,
          onStatus: setNetworkStatus,
        });
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: output } : message));
      } else {
        if (runtimeReady) {
          await generateStreaming(runMessages, (token) => {
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + token } : message));
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 280));
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: previewReplyFor(content, selectedSkill.name, selectedModel.name) } : message));
        }
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      const message = aborted ? 'Generation stopped by user.' : error instanceof Error ? error.message : 'AI generation failed.';
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `Unable to generate: ${message}` } : item));
      if (!aborted) setNotice(message);
    } finally {
      networkAbortRef.current = null;
      setGenerating(false);
      setNetworkStatus(null);
    }
  }

  function stop(): void {
    networkAbortRef.current?.abort();
    networkAbortRef.current = null;
    interruptGeneration();
    setGenerating(false);
    setNetworkStatus('Generation stopped.');
  }

  async function persist(): Promise<void> {
    try {
      const granted = await requestPersistentStorage();
      setNotice(granted ? 'Persistent storage request was granted by the browser.' : 'The browser did not grant persistent storage. Your model can still work, but storage may be cleared by the browser under pressure.');
      await refreshDevice();
    } catch (error) {
      setNotice(error instanceof Error ? `Persistent storage request failed: ${error.message}` : 'Persistent storage request failed.');
    }
  }

  async function unload(): Promise<void> {
    try {
      await unloadRuntime();
      setStatuses((current) => selectedModel ? { ...current, [selectedModel.id]: { stage: 'idle', progress: 0, text: 'Runtime unloaded. Cached files remain in this browser.' } } : current);
      setNotice('The local runtime was unloaded and browser/GPU memory was released.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not unload runtime: ${error.message}` : 'Could not unload the local runtime.');
    }
  }

  async function clearData(): Promise<void> {
    const confirmed = window.confirm('Clear saved chat, settings and AIOS/runtime browser caches? This cannot be undone.');
    if (!confirmed) return;
    try {
      await unloadRuntime();
      await clearBrowserAIData();
      setMessages([]);
      setStatuses({});
      setSelectedModelId(null);
      setNotice('Local AIOS data has been cleared from this browser.');
    } catch (error) {
      setNotice(error instanceof Error ? `Could not clear every local cache: ${error.message}` : 'Could not clear every local cache.');
    }
  }

  async function submitDraft(): Promise<void> {
    const normalized = draft.trim();
    if (!normalized || generating) return;
    setDraft('');
    await send(normalized);
  }

  async function copyText(value: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(value);
      setNotice(successMessage);
    } catch {
      setDraft(value);
      setActiveView('chat');
      setNotice('Clipboard permission was denied, so AIOS placed the text in chat instead.');
    }
  }

  const navItems: Array<{ id: View; label: string; icon: LucideIcon; iconSrc?: string; badge?: string }> = [
    { id: 'home', label: t('navHome'), icon: Home, iconSrc: aiosIcon('logo-mark') },
    { id: 'chat', label: t('navChat'), icon: MessageCircle, iconSrc: aiosIcon('ai-chat') },
    { id: 'agents', label: t('navAgents'), icon: Briefcase, iconSrc: aiosIcon('agents') },
    { id: 'models', label: t('navModels'), icon: Boxes, iconSrc: aiosIcon('models') },
    { id: 'image', label: t('navImages'), icon: Image, iconSrc: aiosIcon('image-generation'), badge: t('newBadge') },
    { id: 'compute', label: t('navComputeShort'), icon: Network, iconSrc: aiosIcon('community-compute'), badge: t('newBadge') },
    { id: 'files', label: t('navFiles'), icon: FileText, iconSrc: aiosIcon('files') },
    { id: 'history', label: t('navHistory'), icon: Clock, iconSrc: aiosIcon('analytics') },
    { id: 'settings', label: t('navSettings'), icon: Settings, iconSrc: aiosIcon('settings') },
  ];

  const statCards = [
    { label: t('modelsAvailable'), value: MODEL_CATALOG.length.toString(), icon: Package, iconSrc: aiosIcon('models'), tone: 'purple' },
    { label: t('agentsAvailable'), value: SKILL_CATALOG.length.toString(), icon: Bot, iconSrc: aiosIcon('agents'), tone: 'cyan' },
    { label: t('communityNodes'), value: networkEnabled ? '1,245' : t('off'), icon: Network, iconSrc: aiosIcon('community-node'), tone: 'green' },
    { label: t('usersOnline'), value: '3,892', icon: Users, iconSrc: aiosIcon('community-compute'), tone: 'blue' },
    { label: t('tasksCompleted'), value: Math.max(24568, visibleMessages.length).toLocaleString(), icon: Briefcase, iconSrc: aiosIcon('automation'), tone: 'purple' },
  ];

  const quickActions = [
    { label: t('importFile'), detail: t('importFileDetail'), icon: Upload, iconSrc: aiosIcon('files'), view: 'files' as View },
    { label: t('voiceChat'), detail: t('voiceChatDetail'), icon: Mic, iconSrc: aiosIcon('voice'), view: 'chat' as View },
    { label: t('createAgent'), detail: t('createAgentDetail'), icon: Sparkles, iconSrc: aiosIcon('marketplace'), view: 'agents' as View },
  ];

  const taskCards = [
    { id: 'worker', title: 'Work Assistant', detail: 'Emails, documents, summaries, reports', icon: Briefcase, iconSrc: aiosIcon('business'), tone: 'violet' },
    { id: 'developer', title: 'Developer', detail: 'Code, debug, explain, generate and optimize', icon: Code2, iconSrc: aiosIcon('developer'), tone: 'blue' },
    { id: 'qa', title: 'QA Engineer', detail: 'Test cases, automation, bug analysis, reports', icon: ShieldCheck, iconSrc: aiosIcon('qa-engineer'), tone: 'green' },
    { id: 'crypto', title: 'Crypto Trader', detail: 'Market analysis, signals, news, portfolio', icon: ChartNoAxesCombined, iconSrc: aiosIcon('crypto-trader'), tone: 'orange' },
    { id: 'student', title: 'Student', detail: 'Learn, research, solve problems, notes', icon: GraduationCap, iconSrc: aiosIcon('student'), tone: 'cyan' },
    { id: 'daily', title: 'Daily Life', detail: 'Translate, travel, health, finance', icon: Sparkles, iconSrc: aiosIcon('daily-life'), tone: 'violet' },
  ];

  const recentAgents = [
    { name: 'Code Expert', version: 'v2.1', icon: Code2, iconSrc: aiosIcon('developer'), tone: 'blue' },
    { name: 'QA Automation', version: 'v1.5', icon: ShieldCheck, iconSrc: aiosIcon('automation'), tone: 'green' },
    { name: 'PDF Analyzer', version: 'v3.0', icon: FileText, iconSrc: aiosIcon('rag-knowledge'), tone: 'orange' },
    { name: 'Data Analyst', version: 'v2.3', icon: Database, iconSrc: aiosIcon('analytics'), tone: 'green' },
    { name: 'Prompt Enhancer', version: 'v1.2', icon: Sparkles, iconSrc: aiosIcon('target'), tone: 'cyan' },
  ];

  const systemRows = [
    { label: 'CPU', value: device ? `${device.cores} threads` : 'Scanning', detail: device?.operatingSystem ?? 'Checking browser', icon: Cpu, iconSrc: aiosIcon('device-scan'), bar: null },
    { label: 'GPU', value: device?.webgpu ? 'WebGPU ready' : 'Unavailable', detail: device?.webgpuAdapterName ?? 'Adapter hidden by browser', icon: Activity, iconSrc: aiosIcon('webgpu'), bar: null },
    { label: 'RAM', value: formatGb(device?.deviceMemoryGb), detail: device?.deviceMemoryGb ? `${device.deviceMemoryGb} GB reported` : 'Browser did not expose RAM', icon: Database, iconSrc: aiosIcon('speed'), bar: Math.min(82, ((device?.deviceMemoryGb ?? 4) / 32) * 100) },
    { label: 'Storage', value: formatGb(device?.storageQuotaGb), detail: device?.storageUsageGb ? `${formatGb(device.storageUsageGb)} used` : 'Quota estimate', icon: HardDrive, iconSrc: aiosIcon('files'), bar: device?.storageQuotaGb ? Math.min(92, ((device.storageUsageGb ?? 0) / device.storageQuotaGb) * 100) : 36 },
    { label: 'WebGPU', value: device?.webgpu ? 'Supported' : 'Not available', detail: device?.shaderF16 ? 'Shader f16 enabled' : 'Shader f16 unavailable', icon: Zap, iconSrc: aiosIcon('local-ai'), bar: null },
    { label: 'Score', value: device ? `${device.score} / 100` : 'Scanning', detail: device ? `${device.tier} profile` : 'Device scan running', icon: CircleCheck, iconSrc: aiosIcon('security'), bar: device?.score ?? 0 },
  ];

  const notifications = [
    { title: t('modelsTitle'), detail: `${MODEL_CATALOG.length} local WebGPU models are available.`, icon: Boxes, tone: 'cyan' },
    { title: t('computeFull'), detail: `${t('tokenCostValue')} for optional community routing.`, icon: Network, tone: 'green' },
    { title: device?.webgpu ? 'WebGPU ready' : 'WebGPU unavailable', detail: device?.webgpu ? 'Your browser can run local AIOS models.' : 'Use a WebGPU-enabled browser/GPU for local models.', icon: Zap, tone: device?.webgpu ? 'green' : 'orange' },
  ];
  const unreadNotifications = notificationsRead ? 0 : notifications.length;

  type SearchItem = {
    id: string;
    title: string;
    detail: string;
    category: string;
    icon: LucideIcon;
    keywords: string;
    action: () => void;
  };

  const searchItems: SearchItem[] = [
    ...navItems.map((item) => ({
      id: `page-${item.id}`,
      title: item.label,
      detail: t('categoryPage'),
      category: t('categoryPage'),
      icon: item.icon,
      keywords: `${item.id} ${item.label}`,
      action: () => setActiveView(item.id),
    })),
    ...quickActions.map((item) => ({
      id: `action-${item.view}-${item.label}`,
      title: item.label,
      detail: item.detail,
      category: t('categoryAction'),
      icon: item.icon,
      keywords: `${item.label} ${item.detail} ${item.view}`,
      action: () => setActiveView(item.view),
    })),
    ...taskCards.map((item) => ({
      id: `task-${item.id}`,
      title: item.title,
      detail: item.detail,
      category: t('categoryAgent'),
      icon: item.icon,
      keywords: `${item.id} ${item.title} ${item.detail}`,
      action: () => launchSkill(item.id, SKILL_CATALOG.find((skill) => skill.id === item.id)?.examples[0]),
    })),
    ...SKILL_CATALOG.map((skill) => {
      const visual = agentVisualFor(skill.id);
      return {
        id: `skill-${skill.id}`,
        title: skill.name,
        detail: skill.description,
        category: t('categoryAgent'),
        icon: visual.icon,
        keywords: `${skill.name} ${skill.description} ${skill.audience} ${skill.examples.join(' ')}`,
        action: () => launchSkill(skill.id, skill.examples[0]),
      };
    }),
    ...MODEL_CATALOG.map((model) => ({
      id: `model-${model.id}`,
      title: model.name,
      detail: `${model.family} - ${model.parameters} - ${model.specialty.join(', ')}`,
      category: t('categoryModel'),
      icon: BrainCircuit,
      keywords: `${model.name} ${model.family} ${model.parameters} ${model.specialty.join(' ')} ${model.description}`,
      action: () => selectModel(model.id),
    })),
    ...IMAGE_MODEL_CATALOG.map((model) => ({
      id: `image-model-${model.id}`,
      title: model.name,
      detail: `${model.base} - ${model.mode}`,
      category: 'Image model',
      icon: Image,
      keywords: `${model.name} ${model.base} ${model.license} ${model.mode} ${model.description} offline local image generation midjourney flux stable diffusion`,
      action: () => setActiveView('image'),
    })),
    { id: 'scan-device', title: t('scanDevice'), detail: t('yourSystem'), category: t('categoryAction'), icon: SlidersHorizontal, keywords: 'scan device hardware gpu webgpu', action: () => void refreshDevice() },
    { id: 'toggle-theme', title: themeMode === 'dark' ? t('themeLight') : t('themeDark'), detail: themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', category: t('categoryAction'), icon: themeMode === 'dark' ? Sun : Moon, keywords: 'theme light dark white mode', action: () => setThemeMode((current) => current === 'dark' ? 'light' : 'dark') },
    { id: 'language-menu', title: t('language'), detail: currentLanguage.name, category: t('categoryAction'), icon: Globe2, keywords: `${LANGUAGES.map((item) => `${item.name} ${item.englishName}`).join(' ')}`, action: () => setLanguageMenuOpen(true) },
  ];
  const searchNeedle = normalizeSearch(searchQuery.trim());
  const searchResults = (searchNeedle
    ? searchItems.filter((item) => normalizeSearch(`${item.title} ${item.detail} ${item.category} ${item.keywords}`).includes(searchNeedle))
    : searchItems.filter((item) => item.id.startsWith('page-') || item.id === 'scan-device')
  ).slice(0, 9);

  function runSearchResult(item: SearchItem): void {
    item.action();
    setSearchQuery('');
    setSearchOpen(false);
  }

  function submitSearch(): void {
    const first = searchResults[0];
    if (first) runSearchResult(first);
  }

  function handleHeroPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const node = heroArtRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    node.style.setProperty('--holo-x', `${(x * 100).toFixed(2)}%`);
    node.style.setProperty('--holo-y', `${(y * 100).toFixed(2)}%`);
    node.style.setProperty('--holo-shift-x', `${((x - 0.5) * 24).toFixed(2)}px`);
    node.style.setProperty('--holo-shift-y', `${((y - 0.5) * 18).toFixed(2)}px`);
    node.style.setProperty('--holo-intensity', '1');
  }

  function handleHeroPointerLeave(): void {
    const node = heroArtRef.current;
    if (!node) return;
    node.style.setProperty('--holo-x', '50%');
    node.style.setProperty('--holo-y', '50%');
    node.style.setProperty('--holo-shift-x', '0px');
    node.style.setProperty('--holo-shift-y', '0px');
    node.style.setProperty('--holo-intensity', '0');
  }

  function renderHome() {
    return (
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="ai-hero glass-panel">
            <div className="hero-copy">
              <h1>{t('heroTitleA')}<span>{t('heroTitleB')}</span></h1>
              <p>{t('heroDescription')}</p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => setActiveView('chat')}><Bot size={16} /> {t('chatWithAi')}</button>
                <button className="secondary-button" onClick={() => void refreshDevice()}><SlidersHorizontal size={16} /> {t('scanDevice')}</button>
              </div>
            </div>
            <div ref={heroArtRef} className="hero-art ai-holo-art" aria-hidden="true" onPointerMove={handleHeroPointerMove} onPointerLeave={handleHeroPointerLeave}>
              <video
                className="hero-art-video"
                src="/media/aios-home-holo-loop.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                disablePictureInPicture
              />
              <div className="hero-art-video-shade" />
              <div className="matrix-rain">
                <span className="matrix-stream stream-one">0101<br />AI<br />神经<br />1010<br />智能<br />00</span>
                <span className="matrix-stream stream-two">11<br />学习<br />001<br />OS<br />01<br />数据</span>
                <span className="matrix-stream stream-three">AIOS<br />1001<br />推理<br />01<br />10<br />语言</span>
                <span className="matrix-stream stream-four">0110<br />模型<br />AI<br />101<br />神<br />连接</span>
                <span className="matrix-stream stream-five">101<br />LOCAL<br />智能<br />00<br />11<br />记忆</span>
                <span className="matrix-stream stream-six">00<br />量子<br />101<br />GPU<br />01<br />向量</span>
                <span className="matrix-stream stream-seven">AI<br />011<br />学习<br />10<br />安全<br />01</span>
                <span className="matrix-stream stream-eight">1010<br />脑<br />0001<br />推理<br />11<br />核</span>
                <span className="matrix-stream stream-nine">LOCAL<br />01<br />模型<br />10<br />隐私<br />AI</span>
                <span className="matrix-stream stream-ten">001<br />token<br />智能<br />11<br />sync<br />01</span>
                <span className="matrix-stream stream-eleven">AIOS<br />010<br />节点<br />11<br />route<br />01</span>
                <span className="matrix-stream stream-twelve">101<br />向量<br />00<br />agent<br />11<br />流</span>
                <span className="matrix-stream stream-thirteen">01<br />privacy<br />智能<br />10<br />GPU<br />00</span>
                <span className="matrix-stream stream-fourteen">11<br />compute<br />模型<br />01<br />AI<br />10</span>
                <span className="matrix-stream stream-fifteen">00<br />设备<br />AIOS<br />10<br />mesh<br />01</span>
                <span className="matrix-stream stream-sixteen">101<br />推理<br />token<br />00<br />节点<br />11</span>
                <span className="matrix-stream stream-seventeen">AI<br />01<br />安全<br />route<br />10<br />私密</span>
                <span className="matrix-stream stream-eighteen">11<br />local<br />GPU<br />00<br />智能<br />01</span>
              </div>
              <div className="holo-scanline" />
              <div className="data-ribbon ribbon-one">0101 / neural sync / local model / 智能 / privacy</div>
              <div className="data-ribbon ribbon-two">kernel online / 1010 / 推理 / secure routing</div>
              <div className="neural-orbit orbit-alpha" />
              <div className="neural-orbit orbit-beta" />
              <div className="neural-orbit orbit-gamma" />
              <div className="signal-card signal-prompt"><img src={aiosIcon('ai-chat')} alt="" /><span>Prompt</span></div>
              <div className="signal-card signal-code"><img src={aiosIcon('developer')} alt="" /><span>Code</span></div>
              <div className="signal-card signal-vision"><img src={aiosIcon('image-generation')} alt="" /><span>Vision</span></div>
              <div className="signal-card signal-files"><img src={aiosIcon('files')} alt="" /><span>Files</span></div>
              <div className="holo-particle particle-a" />
              <div className="holo-particle particle-b" />
              <div className="holo-particle particle-c" />
              <div className="holo-particle particle-d" />
              <div className="holo-focus"><strong>AIOS</strong><small>Neural Core</small></div>
            </div>
          </section>

          <section className="stats-strip">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <article className="stat-card glass-panel" key={stat.label}>
                  <span className={`icon-chip ${stat.tone}`}>{stat.iconSrc ? <img src={stat.iconSrc} alt="" /> : <Icon size={18} />}</span>
                  <div><p>{stat.label}</p><strong>{stat.value}</strong></div>
                </article>
              );
            })}
          </section>

          <section className="work-section glass-panel">
            <div className="section-title-row">
              <h2>{t('workTitle')}</h2>
              <button className="small-link" onClick={() => setActiveView('agents')}>{t('viewAllAgents')} <ArrowRightIcon /></button>
            </div>
            <div className="task-grid">
              {taskCards.map((task) => {
                const Icon = task.icon;
                return (
                  <button key={task.id} className={`task-card ${task.tone}`} onClick={() => selectSkill(task.id)}>
                    <span>{task.iconSrc ? <img className="task-icon-image" src={task.iconSrc} alt="" /> : <Icon size={18} />} {task.title}</span>
                    <p>{task.detail}</p>
                    <b><Sparkles size={12} /> {t('start')}</b>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="recent-section glass-panel">
            <h2>{t('recentAgents')}</h2>
            <div className="recent-grid">
              {recentAgents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <button className="recent-card" key={agent.name} onClick={() => setActiveView('agents')}>
                    <span className={`agent-avatar ${agent.tone}`}>{agent.iconSrc ? <img src={agent.iconSrc} alt="" /> : <Icon size={22} />}</span>
                    <span><strong>{agent.name}</strong><small>{agent.version} <i /></small></span>
                  </button>
                );
              })}
              <button className="recent-add" onClick={() => setActiveView('agents')}><Plus size={20} /></button>
            </div>
          </section>

          <section className="models-section glass-panel">
            <div className="section-title-row">
              <h2>{t('installedModels')}</h2>
              <button className="small-link" onClick={() => setActiveView('models')}>{t('goModels')} <ArrowRightIcon /></button>
            </div>
            <div className="installed-model-grid">
              {displayModels.map((model) => {
                const status = statuses[model.id];
                const disabled = !device?.webgpu || (model.requiresF16 && !device?.shaderF16);
                const progress = status?.stage === 'downloading' ? status.progress : status?.stage === 'ready' ? 100 : Math.max(28, Math.min(78, (model.estimatedVramMb / 5600) * 100));
                return (
                  <article className="installed-model-card" key={model.id}>
                    <div className="model-head">
                      <span className="model-logo"><img src={aiosIcon('models')} alt="" /></span>
                      <div><strong>{model.name}</strong><small>{model.estimatedDownloadGb} GB - GGUF - Q4_K_M</small></div>
                      <em className={status?.stage === 'ready' ? 'ready-pill' : 'ready-pill muted-pill'}>{status?.stage === 'ready' ? 'Ready' : disabled ? 'Blocked' : 'Local'}</em>
                    </div>
                    <div className="usage-row"><span>RAM Usage</span><b>{Math.round(progress)}%</b></div>
                    <div className="mini-progress"><i style={{ width: `${progress}%` }} /></div>
                    <button className="secondary-button compact" disabled={disabled || status?.stage === 'downloading'} onClick={() => status?.stage === 'ready' ? void unload() : void install(model.id)}>
                      {status?.stage === 'ready' ? 'Unload' : status?.stage === 'downloading' ? 'Installing' : t('install')}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="right-rail">
          <section className="system-panel glass-panel">
            <div className="rail-heading"><h2>{t('yourSystem')}</h2><button onClick={() => void refreshDevice()}><RefreshCw size={13} /> {t('rescan')}</button></div>
            <div className="system-list">
              {systemRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div className="system-row" key={row.label}>
                    <span className="system-icon">{row.iconSrc ? <img src={row.iconSrc} alt="" /> : <Icon size={15} />}</span>
                    <div>
                      <strong>{row.label}</strong>
                      <small>{row.detail}</small>
                      {typeof row.bar === 'number' && <div className="system-bar"><i style={{ width: `${Math.max(8, Math.min(100, row.bar))}%` }} /></div>}
                    </div>
                    <b>{row.value}</b>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="compute-card glass-panel">
            <div className="compute-head"><h2>{t('computeFull')}</h2><span>{t('newBadge')}</span></div>
            <p>{t('computeCardText')}</p>
            <div className="compute-metrics">
              <div><small>{t('availableNodes')}</small><strong>{networkEnabled ? '1,245' : t('off')} <i /></strong></div>
              <div><small>{t('tokenCost')}</small><strong>{t('tokenCostValue')}</strong><em>{t('tokenCostDetail')}</em></div>
            </div>
            <button className="primary-button" onClick={() => setActiveView('compute')}>{t('exploreNetwork')}</button>
          </section>

          <section className="status-card glass-panel"><span className="online-dot" /> {t('allSystemsOperational')}</section>
        </aside>
      </div>
    );
  }

  function renderChat() {
    const installing = selectedStatus?.stage === 'downloading';
    const installBlocked = !recommendedModel || installing;
    return (
      <section className="single-view chat-view glass-panel">
        <div className="view-heading">
          <div><span className="eyebrow">AI Chat</span><h1>{selectedSkill.name}</h1><p>{selectedModel ? `${selectedModel.name} selected for this workspace.` : 'Choose a compatible model to start chatting.'}</p></div>
          <button className="secondary-button" onClick={() => setMessages([])}>Clear</button>
        </div>
        <div className={runtimeReady ? 'chat-status ready' : 'chat-status setup'}>
          <Bot size={18} />
          <span>{effectiveRuntime === 'network' ? (networkStatus ?? 'Community Device selected. Avoid confidential content.') : runtimeReady ? 'Local model is ready. Prompts stay in this browser.' : 'Preview mode is available now. Install a local model for real AI generation.'}</span>
          {!runtimeReady && recommendedModel && <button disabled={installBlocked} onClick={() => void install(recommendedModel.id)}>{installing ? 'Installing...' : `Install ${recommendedModel.name}`}</button>}
        </div>
        {!runtimeReady && (
          <div className="chat-setup-grid">
            <article><strong>1. Try Preview</strong><span>Send works now and returns a clear AIOS preview response while the model is not ready.</span></article>
            <article><strong>2. Install Local Model</strong><span>Click Install to download the selected WebGPU model into this browser.</span></article>
            <article><strong>3. Use Real AI</strong><span>When the model shows Ready, prompts stay local and responses stream from the installed model.</span></article>
          </div>
        )}
        <div className="prompt-chips">
          {selectedSkill.examples.map((example) => <button key={example} onClick={() => setDraft(example)}>{example}</button>)}
        </div>
        <div className="chat-window" aria-live="polite">
          {visibleMessages.length === 0 && <div className="empty-chat"><span><MessageCircle size={24} /></span><h3>Start with a simple request</h3><p>Tell AIOS what you need done. The model details stay in the background.</p></div>}
          {visibleMessages.map((message) => (
            <article key={message.id} className={`chat-bubble ${message.role}`}>
              <span>{message.role === 'user' ? 'You' : 'AIOS'}</span>
              <p>{message.content || (generating ? 'Thinking...' : '')}</p>
            </article>
          ))}
        </div>
        <div className="dashboard-composer">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submitDraft(); }} placeholder={`Ask ${selectedSkill.name} anything...`} />
          <div>
            <small>{runtimeReady ? 'Ctrl + Enter to send' : 'Ctrl + Enter sends an AIOS preview until a model is ready'}</small>
            {generating ? <button className="secondary-button" onClick={stop}>Stop</button> : <button className="primary-button" disabled={!draft.trim()} onClick={() => void submitDraft()}>{runtimeReady ? 'Send' : 'Send Preview'}</button>}
          </div>
        </div>
      </section>
    );
  }

  function renderAgents() {
    const selectedVisual = agentVisualFor(selectedSkill.id);
    const SelectedIcon = selectedVisual.icon;
    const selectedAgentModel = selectedSkill.modelPriorities.map(findModel).find((model): model is ModelDefinition => Boolean(model)) ?? recommendedModel;
    return (
      <section className="single-view agents-store-view glass-panel">
        <div className="view-heading">
          <div>
            <span className="eyebrow">{t('navAgents')}</span>
            <h1>{t('agentsMarketTitle')}</h1>
            <p>{t('agentsMarketDesc')}</p>
          </div>
          <button className="secondary-button" onClick={() => setActiveView('models')}><Boxes size={16} /> {t('modelPairing')}</button>
        </div>

        <div className="agent-store-hero">
          <div className="agent-hero-copy">
            <span className={`agent-store-icon large ${selectedVisual.tone}`}>{selectedVisual.iconSrc ? <img src={selectedVisual.iconSrc} alt="" /> : <SelectedIcon size={28} />}</span>
            <div>
              <span className="store-badge">{selectedVisual.badge} selected</span>
              <h2>{selectedSkill.name}</h2>
              <p>{selectedSkill.description}</p>
              <div className="agent-hero-actions">
                <button className="primary-button" onClick={() => launchSkill(selectedSkill.id, selectedSkill.examples[0])}><Sparkles size={16} /> {t('launchAgent')}</button>
                {selectedAgentModel && <button className="secondary-button" onClick={() => selectModel(selectedAgentModel.id)}><Cpu size={16} /> Use {selectedAgentModel.name}</button>}
              </div>
            </div>
          </div>
          <div className="agent-kpi-grid">
            <article><strong>{SKILL_CATALOG.length}</strong><span>{t('readyAgents')}</span></article>
            <article><strong>{MODEL_CATALOG.length}</strong><span>AIOS models</span></article>
            <article><strong>Local</strong><span>{t('privateDefault')}</span></article>
          </div>
        </div>

        <div className="agent-store-grid">
          {SKILL_CATALOG.map((skill) => {
            const visual = agentVisualFor(skill.id);
            const Icon = visual.icon;
            const suggested = skill.modelPriorities.map(findModel).find((model): model is ModelDefinition => Boolean(model));
            return (
              <article key={skill.id} className={`agent-store-card ${visual.tone} ${selectedSkillId === skill.id ? 'selected' : ''}`}>
                <div className="agent-card-top">
                  <span className={`agent-store-icon ${visual.tone}`}>{visual.iconSrc ? <img src={visual.iconSrc} alt="" /> : <Icon size={22} />}</span>
                  <div>
                    <span className="store-badge">{visual.badge}</span>
                    <h3>{skill.name}</h3>
                    <small>{skill.audience}</small>
                  </div>
                  {selectedSkillId === skill.id && <span className="selected-pill"><Check size={13} /> {t('active')}</span>}
                </div>
                <p>{skill.description}</p>
                <div className="agent-meta-row">
                  <span>{visual.version}</span>
                  <span>{visual.installs} installs</span>
                  <span>{suggested?.name ?? 'Auto model'}</span>
                </div>
                <div className="agent-example-list">
                  {skill.examples.slice(0, 2).map((example) => (
                    <button key={example} onClick={() => launchSkill(skill.id, example)}>{example}</button>
                  ))}
                </div>
                <div className="agent-actions">
                  <button className="primary-button compact" onClick={() => launchSkill(skill.id, skill.examples[0])}>{t('launch')}</button>
                  <button className="secondary-button compact" onClick={() => suggested ? selectModel(suggested.id) : setActiveView('models')}>{t('model')}</button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="agent-builder-strip">
          <div><span className="store-badge">Custom studio</span><h2>Need a new AIOS agent?</h2><p>Use the Business Builder to design a role, system prompt, workflows and a model pairing for your own agent.</p></div>
          <button className="secondary-button" onClick={() => launchSkill('business', 'Design a custom AIOS agent for my workflow. Ask me what role, data, tone and outputs it needs.')}>Design in chat</button>
        </div>
      </section>
    );
  }

  function renderCompute() {
    const runtimeCards: Array<{ mode: RuntimePreference; title: string; label: string; detail: string; icon: LucideIcon; iconSrc: string }> = [
      { mode: 'local', title: 'Local only', label: 'Private', detail: 'Prompts stay on this device and use installed AIOS models.', icon: HardDrive, iconSrc: aiosIcon('offline') },
      { mode: 'auto', title: 'Local preferred', label: 'Smart default', detail: 'Use local models first and keep Community Device opt-in.', icon: SlidersHorizontal, iconSrc: aiosIcon('local-ai') },
      { mode: 'network', title: 'Community Device', label: networkEnabled ? 'Ready' : 'Disabled', detail: networkEnabled ? 'Route a bounded text request to an opted-in AIOS device.' : 'Set VITE_COMPUTE_API_URL to enable a coordinator.', icon: Network, iconSrc: aiosIcon('community-compute') },
    ];
    const computeNodes = [
      { name: 'AIOS Berlin Edge', model: 'AIOS Core Llama 3B', load: '62%', latency: networkEnabled ? '42 ms' : 'Offline', price: '2 AIOS / 1K', trust: 'Verified device', tone: 'cyan' },
      { name: 'AIOS Creator GPU', model: 'AIOS Hermes Pro 7B', load: '48%', latency: networkEnabled ? '81 ms' : 'Offline', price: '3 AIOS / 1K', trust: 'High VRAM', tone: 'violet' },
      { name: 'AIOS QA Lab', model: 'AIOS Forge Coder 3B', load: '71%', latency: networkEnabled ? '57 ms' : 'Offline', price: '2 AIOS / 1K', trust: 'Fast queue', tone: 'green' },
      { name: 'AIOS Seoul Matrix', model: 'AIOS Vision Lite 2B', load: '39%', latency: networkEnabled ? '68 ms' : 'Offline', price: '1 AIOS / 1K', trust: 'Low cost', tone: 'blue' },
    ];
    const policyCards = [
      { title: 'Encrypted routing', detail: 'Prompt and result envelopes are encrypted against the coordinator and network path.', icon: LockIcon, iconSrc: aiosIcon('security') },
      { title: 'Provider visibility', detail: 'The provider node can see the prompt in memory while generating, so confidential files stay local.', icon: ShieldCheck, iconSrc: aiosIcon('privacy') },
      { title: 'Bounded text work', detail: 'No shell, arbitrary code, file access, mining workload or background task is accepted.', icon: Cpu, iconSrc: aiosIcon('target') },
      { title: 'AIOS token billing', detail: 'Each route shows the AIOS cost before use, charged per 1K generated or processed tokens.', icon: Package, iconSrc: aiosIcon('marketplace') },
    ];
    const deviceStats = [
      { label: 'Coordinator', value: networkEnabled ? 'Online' : 'Disabled', detail: networkEnabled ? 'Trusted endpoint connected' : 'Configure a trusted coordinator to enable routing', icon: Network, iconSrc: aiosIcon('community-node'), tone: networkEnabled ? 'green' : 'orange' },
      { label: 'AIOS balance', value: 'Not connected', detail: 'Wallet connection is optional for token billing', icon: Package, iconSrc: aiosIcon('marketplace'), tone: 'violet' },
      { label: 'Default route', value: effectiveRuntime === 'network' ? 'Community' : 'Local', detail: 'Local stays preferred unless selected', icon: ShieldCheck, iconSrc: aiosIcon('privacy'), tone: 'cyan' },
    ];
    const routeSteps = [
      { title: '1. Select a route', detail: 'Keep Local, use Local preferred, or opt in to Community Device when the coordinator is enabled.' },
      { title: '2. Review AIOS cost', detail: 'AIOS shows the token price, estimated latency and provider class before the request is sent.' },
      { title: '3. Run bounded inference', detail: 'Only the prompt envelope is routed. Files, shell, desktop access and background jobs stay blocked.' },
    ];
    const activationSteps = [
      { title: 'Create env file', detail: 'Create apps/web/.env.local in this project.', code: 'VITE_COMPUTE_API_URL=https://your-trusted-coordinator.example' },
      { title: 'Restart web app', detail: 'Restart the Vite dev server so AIOS reads the coordinator URL.', code: 'npm.cmd run dev' },
      { title: 'Choose route', detail: 'Return here, select Community Device, then review the AIOS token cost before sending.', code: 'Runtime: Community Device' },
    ];

    return (
      <section className="single-view compute-view glass-panel">
        <div className="view-heading">
          <div><span className="eyebrow">AIOS Device Mesh</span><h1>Community Device</h1><p>Use opted-in AIOS devices for bounded text generation. It is never remote desktop access and it never runs arbitrary jobs.</p></div>
          <button className="secondary-button" onClick={() => setActiveView('chat')}><MessageCircle size={16} /> Open chat</button>
        </div>

        <div className="device-stat-grid">
          {deviceStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article key={stat.label} className={`device-stat-card ${stat.tone}`}>
                <span>{stat.iconSrc ? <img src={stat.iconSrc} alt="" /> : <Icon size={18} />}</span>
                <div><small>{stat.label}</small><strong>{stat.value}</strong><em>{stat.detail}</em></div>
              </article>
            );
          })}
        </div>

        <div className="compute-dashboard">
          <article className="compute-hero-panel">
            <span className={networkEnabled ? 'network-pill live' : 'network-pill'}><span className="online-dot" /> {networkEnabled ? 'Coordinator connected' : 'Coordinator disabled'}</span>
            <h2>Share spare model capacity without sharing the device.</h2>
            <p>AIOS only sends a bounded chat request when you choose Community Device. Confidential files stay local, shell access stays blocked, and every route is priced in AIOS tokens.</p>
            <div className="compute-hero-visual" aria-hidden="true">
              <img src="/media/aios-community-visual.png" alt="" />
              <span>AIOS mesh preview</span>
            </div>
            <div className="compute-mode-grid">
              {runtimeCards.map((card) => {
                const Icon = card.icon;
                const disabled = card.mode === 'network' && !networkEnabled;
                return (
                  <button key={card.mode} disabled={disabled} className={runtimePreference === card.mode ? 'compute-mode-card active' : 'compute-mode-card'} title={disabled ? 'Requires VITE_COMPUTE_API_URL' : card.detail} onClick={() => setRuntimePreference(card.mode)}>
                    <span>{card.iconSrc ? <img src={card.iconSrc} alt="" /> : <Icon size={18} />}</span>
                    <strong>{card.title}</strong>
                    <small>{card.label}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <aside className="compute-live-card">
            <div className="compute-ring"><strong>{networkEnabled ? '1,245' : '0'}</strong><span>devices</span></div>
            <div className="compute-live-metrics">
              <div><small>Active route</small><strong>{effectiveRuntime === 'network' ? 'Community Device' : runtimePreference === 'auto' ? 'Local preferred' : 'Local'}</strong></div>
              <div><small>{t('tokenCost')}</small><strong>{t('tokenCostValue')}</strong></div>
              <div><small>Safety boundary</small><strong>Text only</strong></div>
            </div>
          </aside>
        </div>

        <div className="compute-node-grid">
          {computeNodes.map((node) => (
            <article key={node.name} className={`compute-node-card ${node.tone}`}>
              <div className="node-card-head">
                <span className="store-badge">{networkEnabled ? 'Available' : 'Disabled'}</span>
                <strong>{node.price}</strong>
              </div>
              <div><h3>{node.name}</h3><p>{node.model}</p></div>
              <div className="node-meter"><i style={{ width: node.load }} /></div>
              <div className="node-row"><span>Load {node.load}</span><strong>{node.latency}</strong><span>{node.trust}</span></div>
            </article>
          ))}
        </div>

        <div className="route-step-grid">
          {routeSteps.map((step) => (
            <article key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>

        <div className="compute-policy-grid">
          {policyCards.map((card) => {
            const Icon = card.icon;
            return <article key={card.title}>{card.iconSrc ? <img className="policy-icon-image" src={card.iconSrc} alt="" /> : <Icon size={23} />}<h3>{card.title}</h3><p>{card.detail}</p></article>;
          })}
        </div>

        {!networkEnabled && (
          <div className="compute-config-note">
            <TriangleAlert size={18} />
            <span>Community Device remains disabled by default. Configure `VITE_COMPUTE_API_URL` for a trusted HTTPS coordinator, then choose Community Device above.</span>
          </div>
        )}

        <div className="activation-guide">
          <div className="activation-guide-head">
            <span><Settings size={17} /></span>
            <div><strong>How to enable Community Device</strong><small>{networkEnabled ? 'Coordinator is configured. You can select Community Device above.' : 'Disabled by default for privacy. Enable it only with a trusted coordinator.'}</small></div>
          </div>
          <div className="activation-step-grid">
            {activationSteps.map((step) => (
              <article key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
                <code>{step.code}</code>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderModels() {
    return (
      <section className="single-view models-store-view glass-panel">
        <div className="view-heading">
          <div><span className="eyebrow">{t('navModels')}</span><h1>{t('modelsTitle')}</h1><p>{t('modelsDesc')}</p></div>
          <button className="secondary-button" onClick={() => void refreshDevice()}><RefreshCw size={16} /> {t('rescan')}</button>
        </div>
        <div className="store-summary-row">
          <span><Package size={16} /> {MODEL_CATALOG.length} AIOS models</span>
          <span><Check size={16} /> {compatibleModels.length} {t('compatibleNow')}</span>
          <span><ShieldCheck size={16} /> {t('localFirst')}</span>
        </div>
        <div className="store-grid">
          {MODEL_CATALOG.map((model) => {
            const status = statuses[model.id];
            const selected = selectedModel?.id === model.id;
            const disabled = !device?.webgpu || (model.requiresF16 && !device?.shaderF16);
            return (
              <article key={model.id} className={selected ? 'store-card selected' : 'store-card'}>
                <div className="model-card-top"><span className="model-family">{model.family}</span>{selected && <span className="selected-pill"><Check size={13} /> {t('selected')}</span>}</div>
                <h3>{model.name}</h3>
                <p>{model.description}</p>
                <div className="store-specs"><span>{model.parameters}</span><span>{model.estimatedDownloadGb} GB download</span><span>{Math.round(model.estimatedVramMb / 102.4) / 10} GB GPU memory</span></div>
                {status?.stage === 'downloading' && <div className="install-progress"><div><span>{status.text}</span><strong>{status.progress}%</strong></div><i><b style={{ width: `${status.progress}%` }} /></i></div>}
                {disabled && <div className="compatibility warning"><TriangleAlert size={14} /> This browser cannot run this WebGPU model yet.</div>}
                <div className="model-actions">
                  <button className="secondary-button" onClick={() => selectModel(model.id)}>{t('useModel')}</button>
                  <button className="primary-button compact" disabled={disabled || status?.stage === 'downloading'} onClick={() => void install(model.id)}>
                    {status?.stage === 'ready' ? 'Ready' : status?.stage === 'downloading' ? 'Installing' : t('install')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderImageStudio() {
    const imageSteps = [
      { title: '1. Download model pack', detail: 'AIOS stores the selected model bundle locally. Nothing starts automatically until the user chooses a pack.', icon: Package, iconSrc: aiosIcon('install') },
      { title: '2. Generate offline', detail: 'Run text-to-image through the AIOS desktop runtime, ComfyUI or Diffusers without sending prompts to a cloud GPU.', icon: Cpu, iconSrc: aiosIcon('offline') },
      { title: '3. Keep creative control', detail: 'Prompts, seeds, reference images and outputs stay on the device unless the user exports them.', icon: ShieldCheck, iconSrc: aiosIcon('privacy') },
    ];
    return (
      <section className="single-view image-studio-view glass-panel">
        <div className="view-heading image-studio-heading">
          <div><span className="eyebrow">AIOS Visual Forge</span><h1>AIOS Image Studio</h1><p>Free local image generation packs for offline creators. Midjourney-style flow, AIOS privacy, and model choices that can run on the user's own device.</p></div>
          <button className="secondary-button" onClick={() => void refreshDevice()}><RefreshCw size={16} /> Scan creative device</button>
        </div>

        <div className="image-studio-hero">
          <article className="image-studio-copy">
            <span className="store-badge">Offline image lab</span>
            <h2>Download once. Create anywhere.</h2>
            <p>Choose an image model, install the local pack, and generate premium artwork on the user's own device without cloud GPU billing.</p>
            <div className="image-studio-actions">
              <button className="primary-button" onClick={() => setNotice('Choose a model card below to review its offline pack, VRAM target and license before installation.')}>
                <Package size={16} /> Browse offline packs
              </button>
              <button className="secondary-button" onClick={() => setNotice('Select any image model card and copy a production-ready starter prompt.')}>
                <Sparkles size={16} /> Prompt builder
              </button>
            </div>
          </article>
          <article className="image-studio-preview" aria-hidden="true">
            <img className="image-studio-hero-image" src="/media/aios-image-studio-hero.png" alt="" />
            <div className="image-preview-console">
              <i /><i /><i />
              <strong>AIOS visual engine</strong>
            </div>
          </article>
        </div>

        <div className="image-summary-row">
          <span><img src={aiosIcon('image-generation')} alt="" /> {IMAGE_MODEL_CATALOG.length} image models</span>
          <span><img src={aiosIcon('offline')} alt="" /> Offline-ready packs</span>
          <span><img src={aiosIcon('webgpu')} alt="" /> GPU accelerated</span>
          <span><img src={aiosIcon('privacy')} alt="" /> Private prompts</span>
        </div>

        <article className="image-bridge-card">
          <span><img src={aiosIcon('target')} alt="" /></span>
          <div>
            <strong>Midjourney Prompt Export</strong>
            <p>AIOS can generate polished Midjourney-style prompts for users without depending on an unofficial Midjourney API.</p>
          </div>
          <button className="secondary-button compact" onClick={() => void copyText('cinematic AI operating system, neural interface, premium dark glass dashboard, electric cyan and violet lighting, ultra detailed, dramatic composition --ar 16:9 --stylize 250', 'Midjourney-style prompt copied.')}>Copy MJ prompt</button>
        </article>

        <div className="image-model-grid">
          {IMAGE_MODEL_CATALOG.map((model) => (
            <article key={model.id} className={`image-model-card ${model.tone}`}>
              <div className="image-model-top">
                <span><img src={model.iconSrc} alt="" /></span>
                <div><b>{model.badge}</b><small>{model.base}</small></div>
              </div>
              <h3>{model.name}</h3>
              <p>{model.description}</p>
              <div className="image-model-specs">
                <span>{model.license}</span>
                <span>{model.size}</span>
                <span>{model.memory}</span>
                <span>{model.speed}</span>
              </div>
              <div className="image-model-mode"><HardDrive size={14} /> {model.mode}</div>
              <div className="model-actions">
                <button className="secondary-button" onClick={() => setNotice(`${model.name}: ${model.size}, ${model.memory}, ${model.license}. Install through the AIOS desktop/runtime pack manager.`)}>Offline pack</button>
                <button className="primary-button compact" onClick={() => void copyText(model.prompt, `${model.name} starter prompt copied.`)}>Copy prompt</button>
              </div>
            </article>
          ))}
        </div>

        <div className="image-workflow-grid">
          {imageSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title}>
                <span>{step.iconSrc ? <img src={step.iconSrc} alt="" /> : <Icon size={18} />}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="image-studio-note">
          <TriangleAlert size={18} />
          <span>Midjourney itself should stay as a prompt-export option unless they provide a reliable official API. These local models are the free offline path for AIOS.</span>
        </div>
      </section>
    );
  }

  function renderFiles() {
    const filePrompt = knowledgeFiles.length > 0
      ? `Analyze these local AIOS knowledge files and summarize action items:\n\n${knowledgeFiles.map((file) => `File: ${file.name}\nPreview:\n${file.preview}`).join('\n\n')}`
      : 'Help me organize a private local document workflow in AIOS.';
    return (
      <section className="single-view files-view glass-panel">
        <div className="view-heading">
          <div><span className="eyebrow">Files & Knowledge</span><h1>Local knowledge workspace</h1><p>Add text, code, markdown, CSV or JSON files. Preview content stays in this browser.</p></div>
          <div className="file-heading-actions">
            {knowledgeFiles.length > 0 && <button className="danger-button" onClick={clearKnowledgeFiles}><Trash2 size={15} /> Clear all</button>}
            <label className="primary-button file-upload-button" htmlFor="knowledge-upload"><Upload size={16} /> Add files</label>
          </div>
          <input id="knowledge-upload" className="visually-hidden" type="file" multiple onChange={(event) => { void importKnowledgeFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
        </div>
        <div className="files-layout">
          <article
            className="files-drop-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void importKnowledgeFiles(event.dataTransfer.files);
            }}
          >
            <FileText size={34} />
            <h2>Drop files here</h2>
            <p>Click Add files or drag files into this box. AIOS stores only local previews for this session.</p>
            <label className="secondary-button file-upload-button" htmlFor="knowledge-upload"><Plus size={16} /> Add more files</label>
            <button className="secondary-button" onClick={() => { setRuntimePreference('local'); launchSkill('private-docs', filePrompt); }}>Analyze locally</button>
          </article>
          <div className="file-list">
            <div className="file-list-head">
              <strong>{knowledgeFiles.length === 0 ? 'No files imported yet' : `${knowledgeFiles.length} file${knowledgeFiles.length > 1 ? 's' : ''} added`}</strong>
              <span>Maximum 10 files shown</span>
            </div>
            {knowledgeFiles.length === 0 && <div className="empty-file-list"><Upload size={22} /><strong>No files imported yet</strong><span>Use Add files or drag files into the drop zone.</span></div>}
            {knowledgeFiles.map((file) => (
              <article key={file.id} className="file-row-card">
                <span><FileText size={18} /></span>
                <div><strong>{file.name}</strong><small>{file.size}</small><p>{file.preview}</p></div>
                <button aria-label={`Remove ${file.name}`} onClick={() => removeKnowledgeFile(file.id)}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderHistory() {
    const recentHistory = visibleMessages.slice(-6).reverse();
    return (
      <section className="single-view history-view glass-panel">
        <div className="view-heading">
          <div><span className="eyebrow">History</span><h1>Conversation timeline</h1><p>Review recent local chat turns and resume your current AIOS workspace.</p></div>
          <button className="secondary-button" onClick={() => setActiveView('chat')}><MessageCircle size={16} /> Resume chat</button>
        </div>
        <div className="history-layout">
          <article className="history-stat"><strong>{visibleMessages.length}</strong><span>Total messages</span></article>
          <article className="history-stat"><strong>{selectedSkill.name}</strong><span>Active agent</span></article>
          <article className="history-stat"><strong>{selectedModel?.name ?? 'Auto'}</strong><span>Selected model</span></article>
        </div>
        <div className="history-list">
          {recentHistory.length === 0 && <div className="empty-file-list"><Clock size={22} /><strong>No chat history yet</strong><span>Start a chat and your recent turns will appear here.</span></div>}
          {recentHistory.map((message) => (
            <article key={message.id} className={`history-message ${message.role}`}>
              <span>{message.role === 'user' ? 'You' : 'AIOS'}</span>
              <p>{message.content || 'Thinking...'}</p>
            </article>
          ))}
        </div>
        {recentHistory.length > 0 && <button className="danger-button history-clear" onClick={() => setMessages([])}>Clear history</button>}
      </section>
    );
  }

  function renderUtilityView() {
    if (activeView === 'compute') {
      return renderCompute();
    }

    if (activeView === 'agents') {
      return renderAgents();
    }

    if (activeView === 'image') {
      return renderImageStudio();
    }

    if (activeView === 'settings') {
      return (
        <section className="single-view glass-panel">
          <div className="view-heading"><div><span className="eyebrow">Settings</span><h1>Your device. Your choice.</h1><p>Control local storage, runtime memory and compute routing.</p></div></div>
          <div className="settings-cards">
            <article><Database size={22} /><h3>Storage overview</h3><p>{device?.storageQuotaGb ? `${formatGb(device.storageUsageGb)} used of roughly ${formatGb(device.storageQuotaGb)} exposed to this browser.` : 'The browser does not expose storage quota on this device.'}</p>{!device?.persistentStorage && <button className="secondary-button" onClick={() => void persist()}>Request persistent storage</button>}</article>
            <article><Cpu size={22} /><h3>Runtime memory</h3><p>Unload the active model to release GPU and browser memory. Cached files remain available.</p><button className="secondary-button" onClick={() => void unload()}>Unload runtime</button></article>
            <article><TriangleAlert size={22} /><h3>Erase local AI data</h3><p>Delete saved chat, settings and AIOS runtime caches in this browser.</p><button className="danger-button" onClick={() => void clearData()}>Clear local data</button></article>
          </div>
        </section>
      );
    }

    if (activeView === 'files') {
      return renderFiles();
    }

    if (activeView === 'history') {
      return renderHistory();
    }

    return (
      <section className="single-view glass-panel">
        <div className="view-heading"><div><span className="eyebrow">{activeView}</span><h1>AIOS workspace</h1><p>Pick a section from the sidebar to continue.</p></div></div>
      </section>
    );
  }

  return (
    <div id="top" className={`dashboard-shell ${themeMode}-theme`}>
      <aside className="sidebar">
        <a className="sidebar-brand" href="#top" onClick={() => setActiveView('home')} aria-label="AIOS home">
          <span className="aios-mark"><BrainCircuit size={26} /></span>
          <span><strong>AIOS</strong><small>{t('brandSubtitle')}</small></span>
        </a>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeView === item.id ? 'active' : ''} onClick={() => setActiveView(item.id)}>
                {item.iconSrc ? <img className="nav-image-icon" src={item.iconSrc} alt="" /> : <Icon size={17} />}
                <span>{item.label}</span>
                {item.badge && <b>{item.badge}</b>}
              </button>
            );
          })}
        </nav>
        <section className="sidebar-quick-card" aria-label={t('quickActions')}>
          <div className="sidebar-quick-head">
            <span><Sparkles size={14} /></span>
            <div><strong>{t('quickActions')}</strong><small>AIOS shortcuts</small></div>
          </div>
          <div className="sidebar-quick-list">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} onClick={() => setActiveView(action.view)}>
                  <span>{action.iconSrc ? <img src={action.iconSrc} alt="" /> : <Icon size={15} />}</span>
                  <div><strong>{action.label}</strong><small>{action.detail}</small></div>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
        </section>
        <div className="sidebar-spacer" />
      </aside>

      <div className="dashboard-content">
        <header className="topbar">
          <div ref={searchBoxRef} className={searchOpen ? 'search-box search-active' : 'search-box'}>
            <Search size={18} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              placeholder={t('searchPlaceholder')}
              onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => {
                setSearchOpen(true);
                setLanguageMenuOpen(false);
                setNotificationsOpen(false);
                setProfileOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch();
                }
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />
            <kbd>Ctrl K</kbd>
            {searchOpen && (
              <div className="search-results-panel">
                <div className="search-panel-head"><strong>{t('searchResults')}</strong><span>{t('searchHint')}</span></div>
                {searchResults.length === 0 && <div className="search-empty"><Search size={18} /> {t('searchEmpty')}</div>}
                {searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} className="search-result-item" onMouseDown={(event) => event.preventDefault()} onClick={() => runSearchResult(item)}>
                      <span><Icon size={17} /></span>
                      <div><strong>{item.title}</strong><small>{item.category} - {item.detail}</small></div>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button aria-label={themeMode === 'dark' ? t('themeLight') : t('themeDark')} title={themeMode === 'dark' ? t('themeLight') : t('themeDark')} onClick={() => setThemeMode((current) => current === 'dark' ? 'light' : 'dark')}>
              {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div ref={notificationRef} className="notification-switcher">
              <button className="notification-button" aria-label={t('notifications')} onClick={() => {
                setNotificationsOpen((open) => !open);
                setLanguageMenuOpen(false);
                setProfileOpen(false);
                setSearchOpen(false);
              }}>
                <Bell size={18} />
                {unreadNotifications > 0 && <span>{unreadNotifications}</span>}
              </button>
              {notificationsOpen && (
                <div className="notification-menu">
                  <div className="panel-menu-head">
                    <strong>{t('notifications')}</strong>
                    <button onClick={() => setNotificationsRead(true)}>{t('markAllRead')}</button>
                  </div>
                  {notifications.length === 0 && <div className="panel-empty">{t('noNotifications')}</div>}
                  {notifications.map((item) => {
                    const Icon = item.icon;
                    return (
                      <article key={item.title} className={`notification-item ${item.tone}`}>
                        <span><Icon size={17} /></span>
                        <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                        {!notificationsRead && <i />}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            <div ref={languageRef} className="language-switcher">
              <button className="language-button" onClick={() => {
                setLanguageMenuOpen((open) => !open);
                setNotificationsOpen(false);
                setProfileOpen(false);
                setSearchOpen(false);
              }} aria-expanded={languageMenuOpen}>
                <Globe2 size={16} /> <FlagMark code={currentLanguage.flag} /> {currentLanguage.short} <ChevronRight size={14} />
              </button>
              {languageMenuOpen && (
                <div className="language-menu">
                  <div className="language-menu-head">{t('language')}</div>
                  {LANGUAGES.map((item) => (
                    <button key={item.code} className={item.code === language ? 'active' : ''} onClick={() => { setLanguage(item.code); setLanguageMenuOpen(false); }}>
                      <FlagMark code={item.flag} />
                      <strong>{item.name}</strong>
                      <small>{item.englishName}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={profileRef} className="profile-switcher">
              <button className="profile-button" onClick={() => {
                setProfileOpen((open) => !open);
                setLanguageMenuOpen(false);
                setNotificationsOpen(false);
                setSearchOpen(false);
              }} aria-expanded={profileOpen}>
                {profileAvatar ? <img className="user-avatar small image-avatar" src={profileAvatar} alt="" /> : <span className="user-avatar small">{initialsFor(profileName)}</span>}
                <ChevronRight size={14} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="panel-menu-head"><strong>{t('profile')}</strong><small>{t('saveProfile')}</small></div>
                  <label className="profile-field">
                    <span>{t('displayName')}</span>
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={42} />
                  </label>
                  <div className="avatar-editor">
                    {profileAvatar ? <img src={profileAvatar} alt="" /> : <span>{initialsFor(profileName)}</span>}
                    <div>
                      <strong>{t('avatar')}</strong>
                      <label className="secondary-button compact" htmlFor="avatar-upload"><Upload size={14} /> {t('uploadAvatar')}</label>
                      <input id="avatar-upload" className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void uploadAvatar(event.currentTarget.files); event.currentTarget.value = ''; }} />
                    </div>
                  </div>
                  <div className="avatar-presets">
                    {[
                      ['#7c5cff', '#5eead4'],
                      ['#ff8a5b', '#ffd166'],
                      ['#4f8cff', '#9b5cff'],
                      ['#17c964', '#62e6ff'],
                    ].map(([from, to]) => (
                      <button key={`${from}-${to}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} onClick={() => setProfileAvatar(generatedAvatar(profileName, from, to))} aria-label="Use generated avatar" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-page">
          {notice && <div className="notice"><TriangleAlert size={16} /><span>{notice}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
          {activeView === 'home' && renderHome()}
          {activeView === 'chat' && renderChat()}
          {activeView === 'models' && renderModels()}
          {activeView !== 'home' && activeView !== 'chat' && activeView !== 'models' && renderUtilityView()}
        </main>
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return <ChevronRight size={14} />;
}

function LockIcon() {
  return <ShieldCheck size={22} />;
}

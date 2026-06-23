import { Bot, FileText, Mic, Paperclip, Send, Square, Volume2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ModelDefinition, SkillDefinition } from '../data/catalog';
import type { ChatMessage, InstallStatus } from '../types';

interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function AgentWorkspace({
  skill,
  model,
  status,
  messages,
  isGenerating,
  onSend,
  onStop,
  onClear,
  runtimeMode,
  networkStatus,
}: {
  skill: SkillDefinition;
  model: ModelDefinition | null;
  status?: InstallStatus;
  messages: ChatMessage[];
  isGenerating: boolean;
  onSend: (content: string) => Promise<void>;
  onStop: () => void;
  onClear: () => void;
  runtimeMode: 'local' | 'network';
  networkStatus?: string | null;
}) {
  const [draft, setDraft] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'unsupported'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const isReady = runtimeMode === 'network' || status?.stage === 'ready';

  async function submit(): Promise<void> {
    const normalized = draft.trim();
    if (!normalized || isGenerating) return;
    setDraft('');
    await onSend(normalized);
  }

  async function readTextFile(file: File): Promise<void> {
    const supported = /\.(txt|md|csv|json|log)$/i.test(file.name);
    if (!supported) {
      setDraft(`I selected “${file.name}”. This MVP safely supports plain-text files (.txt, .md, .csv, .json, .log). Add a PDF parser or document pipeline before enabling PDFs in production.`);
      return;
    }
    const text = await file.text();
    const safeText = text.slice(0, 12_000);
    setDraft(`Please analyze this local file: ${file.name}\n\n---\n${safeText}\n---`);
  }

  function startVoiceInput(): void {
    const WindowWithSpeech = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = WindowWithSpeech.SpeechRecognition || WindowWithSpeech.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState('unsupported');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      setDraft((previous) => `${previous}${previous ? ' ' : ''}${event.results[0][0].transcript}`);
    };
    recognition.onerror = () => setVoiceState('idle');
    recognition.onend = () => setVoiceState('idle');
    setVoiceState('listening');
    recognition.start();
  }

  function speakLatest(): void {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());
    if (!lastAssistant || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lastAssistant.content);
    utterance.lang = navigator.language || 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="workspace panel" aria-label="AI agent workspace">
      <header className="workspace-header">
        <div className="agent-id"><span className="agent-icon">{skill.icon}</span><div><span className="eyebrow">Active skill</span><h2>{skill.name}</h2></div></div>
        <button className="icon-button" onClick={onClear} aria-label="Clear local chat"><X size={17} /></button>
      </header>
      <div className="runtime-banner">
        <Bot size={17} />
        <span>{runtimeMode === 'network' ? <><strong>Community Device selected.</strong> {networkStatus ?? 'Your encrypted text request will be routed to an opted-in provider device. Never send confidential data, passwords or private files.'}</> : isReady ? <><strong>{model?.name}</strong> is ready locally. Your prompt stays in this browser.</> : <><strong>Local runtime not installed.</strong> Choose a recommended model below, then click Install.</>}</span>
      </div>
      <div className="example-chips">
        {skill.examples.map((example) => <button key={example} onClick={() => setDraft(example)}>{example}</button>)}
      </div>
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && <div className="empty-chat"><span>{skill.icon}</span><h3>Start with a simple request</h3><p>You do not need to understand models or settings. Tell AIOS what you need done.</p></div>}
        {messages.filter((message) => message.role !== 'system').map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <span>{message.role === 'user' ? 'You' : 'AIOS'}</span><p>{message.content || (isGenerating ? (runtimeMode === 'network' ? (networkStatus ?? 'Routing encrypted request…') : 'Thinking locally…') : '')}</p>
          </article>
        ))}
      </div>
      <div className="composer">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit(); }} placeholder={`Ask ${skill.name} anything…`} aria-label="Your message" />
        <div className="composer-actions">
          <div>
            <input ref={fileRef} className="visually-hidden" type="file" accept=".txt,.md,.csv,.json,.log" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readTextFile(file); event.currentTarget.value = ''; }} />
            <button className="icon-button" title="Attach a local text file" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
            <button className={voiceState === 'listening' ? 'icon-button recording' : 'icon-button'} title={voiceState === 'unsupported' ? 'Voice input is not supported by this browser' : 'Use voice input'} onClick={startVoiceInput}><Mic size={18} /></button>
            <button className="icon-button" title="Read latest answer aloud" onClick={speakLatest}><Volume2 size={18} /></button>
          </div>
          {isGenerating ? <button className="secondary-button" onClick={onStop}><Square size={15} /> Stop</button> : <button className="primary-button" disabled={!isReady || !draft.trim()} onClick={() => void submit()}><Send size={16} /> Send</button>}
        </div>
        {voiceState === 'unsupported' && <small className="voice-note">Voice input is not exposed by this browser. You can still type or attach a local text file.</small>}
        <small className="shortcut-note"><FileText size={12} /> {runtimeMode === 'network' ? 'Do not attach sensitive files in Community Device mode. Press Ctrl/Cmd + Enter to send.' : 'Local text files stay in this browser. Press Ctrl/Cmd + Enter to send.'}</small>
      </div>
    </section>
  );
}

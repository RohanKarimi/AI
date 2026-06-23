import { DatabaseZap, Eraser, MonitorCog, Network, ShieldCheck, Trash2 } from 'lucide-react';
import type { DeviceProfile, RuntimePreference } from '../types';

export function SettingsPanel({
  device,
  runtimePreference,
  networkEnabled,
  onRuntimePreference,
  onClearData,
  onUnload,
}: {
  device: DeviceProfile | null;
  runtimePreference: RuntimePreference;
  networkEnabled: boolean;
  onRuntimePreference: (preference: RuntimePreference) => void;
  onClearData: () => void;
  onUnload: () => void;
}) {
  return (
    <section className="section-block settings-layout" id="settings">
      <div className="settings-intro"><span className="eyebrow">Privacy and control</span><h2>Your device. Your choice.</h2><p>AIOS runs locally only after you explicitly install a model. Community Device is an optional, restricted route for a voluntary provider device — it is never full computer sharing.</p></div>
      <div className="settings-grid">
        <article className="setting-card"><ShieldCheck size={20} /><h3>Runtime policy</h3><p>Local is the default. “Local preferred” reserves a future controlled fallback. Network sends only an encrypted text-generation request to an opted-in device, and should never be used for confidential data.</p><div className="segmented runtime-choice"><button className={runtimePreference === 'local' ? 'active' : ''} onClick={() => onRuntimePreference('local')}>Local only</button><button className={runtimePreference === 'auto' ? 'active' : ''} onClick={() => onRuntimePreference('auto')}>Local preferred</button><button disabled={!networkEnabled} className={runtimePreference === 'network' ? 'active' : ''} onClick={() => onRuntimePreference('network')} title={networkEnabled ? 'Use opted-in Community Device' : 'Requires VITE_COMPUTE_API_URL and HTTPS'}><Network size={13} /> Community Device</button></div>{!networkEnabled && <small>Community Device is not configured for this deployment. It stays disabled by default.</small>}</article>
        <article className="setting-card"><DatabaseZap size={20} /><h3>Storage overview</h3><p>{device?.storageQuotaGb ? `${device.storageUsageGb ?? 0} GB used of roughly ${device.storageQuotaGb} GB exposed to this browser.` : 'The browser does not expose storage quota on this device.'}</p><small>Model weights are cached by the runtime in browser-managed storage.</small></article>
        <article className="setting-card"><MonitorCog size={20} /><h3>Runtime memory</h3><p>Unload the currently active model to release GPU/browser memory. Cached model files remain available for the next session.</p><button className="secondary-button" onClick={onUnload}><Eraser size={15} /> Unload runtime</button></article>
        <article className="setting-card danger"><Trash2 size={20} /><h3>Erase local AI data</h3><p>Delete saved chat, settings and AIOS/runtime caches in this browser. This action cannot be undone.</p><button className="danger-button" onClick={onClearData}><Trash2 size={15} /> Clear local data</button></article>
      </div>
    </section>
  );
}

import { Cpu, HardDrive, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { DeviceProfile } from '../types';

export function DevicePanel({ device, loading, onRescan, onPersist }: { device: DeviceProfile | null; loading: boolean; onRescan: () => void; onPersist: () => void }) {
  if (loading || !device) {
    return <section className="panel device-panel"><div className="panel-heading"><div><span className="eyebrow">Device intelligence</span><h2>Checking your browser</h2></div><LoaderCircle className="spin" /></div><div className="scanner-lines"><span /><span /><span /><span /></div><p className="muted">AIOS checks browser-supported capabilities only. It cannot read your files, passwords or exact hardware inventory.</p></section>;
  }

  const rows = [
    ['Browser', device.browser],
    ['System', device.operatingSystem],
    ['CPU threads', String(device.cores)],
    ['Reported memory', device.deviceMemoryGb ? `${device.deviceMemoryGb} GB` : 'Not exposed by browser'],
    ['Storage quota', device.storageQuotaGb ? `${device.storageQuotaGb} GB` : 'Not exposed by browser'],
    ['WebGPU', device.webgpu ? 'Available' : 'Unavailable'],
    ['Shader f16', device.shaderF16 ? 'Available' : 'Unavailable'],
  ];

  return (
    <section className="panel device-panel">
      <div className="panel-heading">
        <div><span className="eyebrow"><Sparkles size={14} /> Device intelligence</span><h2>Your local AI readiness</h2></div>
        <button className="icon-button" onClick={onRescan} aria-label="Scan device again"><RefreshCw size={16} /></button>
      </div>
      <div className="readiness-row">
        <div className={`score-ring ${device.tier}`}><strong>{device.score}</strong><span>/100</span></div>
        <div><p className="tier-label">{device.tier} device</p><p className="muted">{device.webgpu ? 'Local AI is supported in this browser.' : 'Use a WebGPU-compatible browser for local AI.'}</p></div>
      </div>
      <div className="device-grid">
        {rows.map(([label, value]) => <div key={label} className="device-row"><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {device.webgpuAdapterName && <div className="adapter-line"><Cpu size={15} /><span>GPU adapter: {device.webgpuAdapterName}</span></div>}
      <div className="storage-action">
        <div><HardDrive size={16} /><span>Persistent storage: <strong>{device.persistentStorage ? 'enabled' : 'not requested'}</strong></span></div>
        {!device.persistentStorage && <button className="text-button" onClick={onPersist}>Request</button>}
      </div>
    </section>
  );
}

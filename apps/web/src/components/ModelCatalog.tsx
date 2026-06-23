import { Check, Download, HardDriveDownload, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ModelDefinition } from '../data/catalog';
import type { DeviceProfile, InstallStatus } from '../types';

export function ModelCatalog({
  models,
  device,
  selectedModelId,
  statuses,
  onSelect,
  onInstall,
}: {
  models: ModelDefinition[];
  device: DeviceProfile | null;
  selectedModelId: string | null;
  statuses: Record<string, InstallStatus | undefined>;
  onSelect: (id: string) => void;
  onInstall: (model: ModelDefinition) => void;
}) {
  return (
    <section className="section-block" id="models">
      <div className="section-heading"><div><span className="eyebrow">Local model library</span><h2>Transparent, compatible choices</h2></div><p>Model downloads happen only after you explicitly install one. Download size and device requirements are shown before installation.</p></div>
      <div className="model-grid">
        {models.map((model) => {
          const status = statuses[model.id];
          const selected = selectedModelId === model.id;
          const disabled = !device?.webgpu || (model.requiresF16 && !device?.shaderF16);
          return (
            <article key={model.id} className={selected ? 'model-card selected' : 'model-card'}>
              <div className="model-card-top"><span className="model-family">{model.family}</span>{selected && <span className="selected-pill"><Check size={13} /> Selected</span>}</div>
              <h3>{model.name}</h3>
              <p>{model.description}</p>
              <div className="model-specs"><span>{model.parameters}</span><span><HardDriveDownload size={14} /> ~{model.estimatedDownloadGb} GB</span><span><Info size={14} /> ~{Math.round(model.estimatedVramMb / 1024 * 10) / 10} GB GPU memory</span></div>
              <div className="tags">{model.specialty.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {disabled && <div className="compatibility warning"><TriangleAlert size={14} /> This browser cannot run this WebGPU model yet.</div>}
              {status?.stage === 'error' && <div className="compatibility warning"><TriangleAlert size={14} /> {status.error || status.text}</div>}
              {status?.stage === 'downloading' && <div className="install-progress"><div><span>{status.text}</span><strong>{status.progress}%</strong></div><i><b style={{ width: `${status.progress}%` }} /></i></div>}
              <div className="model-actions">
                <button className="secondary-button" onClick={() => onSelect(model.id)}>Use this model</button>
                <button className="primary-button compact" disabled={disabled || status?.stage === 'downloading'} onClick={() => onInstall(model)}>
                  {status?.stage === 'ready' ? <><Check size={15} /> Ready</> : status?.stage === 'downloading' ? <><LoaderCircle className="spin" size={15} /> Installing</> : <><Download size={15} /> Install</>}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

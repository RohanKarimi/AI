import { CheckCircle2, Cpu, LockKeyhole, Network, ShieldAlert, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ModelDefinition } from '../data/catalog';
import { listPublicNodes, networkComputeConfigured, type PublicComputeNode } from '../lib/networkCompute';

export function NetworkComputePanel({ model }: { model: ModelDefinition | null }) {
  const [nodes, setNodes] = useState<PublicComputeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = networkComputeConfigured();

  async function refresh(): Promise<void> {
    if (!configured || !model?.networkModelId) return;
    setLoading(true);
    setError(null);
    try {
      setNodes(await listPublicNodes(model.networkModelId));
    } catch (refreshError) {
      setNodes([]);
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load compatible providers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [model?.networkModelId, configured]);

  return (
    <section className="section-block network-layout" id="network">
      <div className="network-intro">
        <span className="eyebrow"><Network size={14} /> Community Device</span>
        <h2>Borrow power without sharing someone else's full computer.</h2>
        <p>AIOS Community Device routes a limited text-generation request to a voluntary provider device. The provider chooses the models, capacity and operating time. This is never remote desktop access.</p>
        <div className="network-boundaries">
          <span><LockKeyhole size={15} /> Prompt/result encrypted in transit</span>
          <span><ShieldAlert size={15} /> Provider can see prompts during generation</span>
          <span><Cpu size={15} /> No arbitrary code or files</span>
        </div>
      </div>
      <div className="network-card">
        <div className="network-card-head"><div><span className="eyebrow">Network status</span><h3>{configured ? 'Ready for opted-in nodes' : 'Not configured on this deployment'}</h3></div><span className={configured ? 'status-pill online' : 'status-pill'}>{configured ? 'Configured' : 'Local only'}</span></div>
        <p>{configured ? `A compatible provider may run ${model?.networkModelId ?? 'the selected model'} for you. Local mode remains the privacy-first default.` : 'Set VITE_COMPUTE_API_URL to enable an HTTPS coordinator. The feature remains off until then.'}</p>
        <div className="network-node-count"><Zap size={18} /><strong>{loading ? 'Checking providers...' : `${nodes.length} compatible provider${nodes.length === 1 ? '' : 's'} available`}</strong></div>
        {error && <p role="alert">{error}</p>}
        <div className="network-card-actions"><button className="secondary-button" disabled={!configured || loading || !model?.networkModelId} onClick={() => void refresh()}>Refresh availability</button></div>
      </div>
      <div className="network-rules">
        <article><CheckCircle2 size={18} /><h3>For requesters</h3><p>Use network mode only for content you are comfortable sharing with the selected provider. Private documents, secrets and credentials stay local.</p></article>
        <article><CheckCircle2 size={18} /><h3>For providers</h3><p>Run the AIOS Node Agent only on a device you control. Configure one model, token/job limits, and stop the process at any time.</p></article>
        <article><CheckCircle2 size={18} /><h3>Not included</h3><p>No remote shell, browser automation, GPU mining, background jobs, system virtualization or access to local disks is part of this protocol.</p></article>
      </div>
    </section>
  );
}

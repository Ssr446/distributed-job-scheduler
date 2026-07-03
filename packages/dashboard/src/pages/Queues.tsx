import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Loader2, Plus, Play, Pause, Activity, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateQueueModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateQueueModal({ projectId, onClose, onCreated }: CreateQueueModalProps) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('0');
  const [concurrency, setConcurrency] = useState('5');
  const [rateLimit, setRateLimit] = useState('');
  const [maxDuration, setMaxDuration] = useState('300');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Queue name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/queues`, {
        name: name.trim(),
        priority: parseInt(priority) || 0,
        concurrencyLimit: parseInt(concurrency) || 5,
        rateLimitPerSec: rateLimit ? parseInt(rateLimit) : null,
        maxJobDurationMs: (parseInt(maxDuration) || 300) * 1000,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to create queue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative theme-modal rounded-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-base)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl badge-accent">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Queue</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Add a new job queue to the project</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors cursor-pointer btn-ghost border-none hover:bg-transparent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Queue Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. payments-high-priority"
              className="w-full theme-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Priority</label>
              <input
                type="number" value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full theme-input"
              />
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Higher = processed first</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Concurrency</label>
              <input
                type="number" value={concurrency} onChange={e => setConcurrency(e.target.value)}
                className="w-full theme-input"
              />
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Parallel job limit</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Rate Limit (req/s)</label>
              <input
                type="number" value={rateLimit} onChange={e => setRateLimit(e.target.value)}
                placeholder="None"
                className="w-full theme-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Max Duration (s)</label>
              <input
                type="number" value={maxDuration} onChange={e => setMaxDuration(e.target.value)}
                className="w-full theme-input"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm px-4 py-2.5 rounded-xl badge-error">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 btn-ghost">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
              style={saving ? { opacity: 0.5 } : {}}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Queues() {
  const [queues, setQueues] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const loadQueues = async () => {
    try {
      const orgRes = await api.get('/orgs');
      const org = orgRes.data?.data?.[0];
      if (!org) return;

      const projRes = await api.get(`/orgs/${org.id}/projects`);
      const project = projRes.data?.data?.[0];
      if (!project) return;
      setProjectId(project.id);

      const queuesRes = await api.get(`/projects/${project.id}/queues`);
      setQueues(queuesRes.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
    const interval = setInterval(loadQueues, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerJob = async (e: React.MouseEvent, queueId: string) => {
    e.stopPropagation();
    try {
      await api.post(`/queues/${queueId}/jobs`, {
        type: 'manual_trigger',
        payload: { triggeredFrom: 'dashboard', ts: new Date().toISOString() }
      });
      loadQueues();
    } catch (e) {
      alert('Failed to enqueue job');
    }
  };

  const togglePause = async (e: React.MouseEvent, queueId: string, isPaused: boolean) => {
    e.stopPropagation();
    try {
      await api.post(`/queues/${queueId}/${isPaused ? 'resume' : 'pause'}`);
      loadQueues();
    } catch {
      alert('Failed to toggle queue');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading queues...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Message Queues</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>Manage and monitor your active queues</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadQueues}
            className="p-2.5 rounded-xl transition-colors cursor-pointer btn-ghost border-none hover:bg-transparent"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create Queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {queues.map((q) => (
          <div
            key={q.id}
            onClick={() => navigate(`/queues/${q.id}`)}
            className="theme-card rounded-2xl transition-all duration-300 group cursor-pointer flex flex-col"
          >
            {/* Card body */}
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl group-hover:scale-110 transition-transform badge-accent">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{q.name}</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Pri {q.priority} · Con {q.concurrencyLimit}
                    </p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${q.isPaused ? 'badge-paused' : 'badge-active'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${q.isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  {q.isPaused ? 'PAUSED' : 'ACTIVE'}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Queued',    val: q.stats?.queued    ?? 0, color: 'var(--stat-queued)' },
                  { label: 'Running',   val: q.stats?.running   ?? 0, color: 'var(--stat-running)' },
                  { label: 'Completed', val: q.stats?.completed ?? 0, color: 'var(--stat-completed)' },
                  { label: 'Failed',    val: q.stats?.failed    ?? 0, color: 'var(--stat-failed)' },
                ].map(stat => (
                  <div key={stat.label} className="theme-panel rounded-xl p-3 shadow-none">
                    <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                    <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.val.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card footer actions */}
            <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border-base)', background: 'var(--bg-hover)' }} onClick={e => e.stopPropagation()}>
              <button
                onClick={e => togglePause(e, q.id, q.isPaused)}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${q.isPaused ? 'badge-active' : 'btn-ghost border-none hover:bg-transparent hover:text-[var(--stat-paused)]'}`}
              >
                {q.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {q.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={e => triggerJob(e, q.id)}
                title="Enqueue test job"
                className="flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer btn-ghost border-none hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                Test Job
              </button>
            </div>
          </div>
        ))}

        {queues.length === 0 && (
          <div className="col-span-full py-20 text-center theme-panel rounded-2xl">
            <Activity className="w-14 h-14 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No Queues Found</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Create your first queue to start processing jobs.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 btn-primary text-sm"
            >
              <Plus className="w-4 h-4" /> Create First Queue
            </button>
          </div>
        )}
      </div>

      {showCreate && projectId && (
        <CreateQueueModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={loadQueues}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Loader2, Server, Activity, Clock, RefreshCw, Cpu, Layers, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Worker {
  id: string;
  name: string;
  hostname: string;
  pid: number;
  status: 'ONLINE' | 'BUSY' | 'DRAINING' | 'OFFLINE';
  concurrency: number;
  activeJobs: number;
  queues: string[];
  lastHeartbeatAt?: string;
  registeredAt: string;
}

interface WorkerDetailModal {
  worker: Worker;
  onClose: () => void;
}

function WorkerDetailModal({ worker, onClose }: WorkerDetailModal) {
  const utilizationPct = worker.concurrency > 0 ? Math.round((worker.activeJobs / worker.concurrency) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative theme-modal rounded-2xl w-full max-w-lg animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-base)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl theme-card shadow-none">
              <Server className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{worker.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{worker.hostname} · PID {worker.pid}</p>
            </div>
          </div>
          <StatusBadge status={worker.status} />
        </div>

        <div className="p-6 space-y-5">
          {/* Utilization bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Job Utilization</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{worker.activeJobs} / {worker.concurrency} ({utilizationPct}%)</span>
            </div>
            <div className="w-full bg-[var(--bg-hover)] rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700`}
                style={{ width: `${utilizationPct}%`, background: utilizationPct > 80 ? 'var(--error-text)' : utilizationPct > 50 ? 'var(--warning-text)' : 'var(--success-text)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="theme-panel rounded-xl p-4 shadow-none">
              <Cpu className="w-4 h-4 mb-2" style={{ color: 'var(--accent-primary)' }} />
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Concurrency Limit</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{worker.concurrency}</p>
            </div>
            <div className="theme-panel rounded-xl p-4 shadow-none">
              <Activity className="w-4 h-4 mb-2" style={{ color: 'var(--success-text)' }} />
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Active Jobs</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{worker.activeJobs}</p>
            </div>
            <div className="theme-panel rounded-xl p-4 shadow-none">
              <Clock className="w-4 h-4 mb-2" style={{ color: 'var(--warning-text)' }} />
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Last Heartbeat</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {worker.lastHeartbeatAt ? formatDistanceToNow(new Date(worker.lastHeartbeatAt), { addSuffix: true }) : 'Never'}
              </p>
            </div>
            <div className="theme-panel rounded-xl p-4 shadow-none">
              <Layers className="w-4 h-4 mb-2" style={{ color: 'var(--accent-primary)' }} />
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Registered</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {worker.registeredAt ? formatDistanceToNow(new Date(worker.registeredAt), { addSuffix: true }) : 'Unknown'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Queue Subscriptions</p>
            <div className="flex flex-wrap gap-2">
              {(worker.queues || []).map((q, i) => (
                <span key={i} className="px-3 py-1 rounded-lg text-xs font-medium badge-accent">
                  {q === '*' ? '✦ All Queues' : q}
                </span>
              ))}
              {(!worker.queues || worker.queues.length === 0) && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No queues assigned</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 btn-ghost font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; dot: string }> = {
    ONLINE:   { cls: 'badge-active', dot: 'bg-emerald-400 animate-pulse' },
    BUSY:     { cls: 'badge-accent', dot: 'bg-blue-400 animate-pulse' },
    DRAINING: { cls: 'badge-paused', dot: 'bg-amber-400' },
    OFFLINE:  { cls: 'badge-muted',  dot: 'bg-slate-500' },
  };
  const { cls, dot } = cfg[status] || cfg.OFFLINE;
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} style={status === 'ONLINE' ? {background: 'var(--success-text)'} : status === 'BUSY' ? {background: 'var(--accent-primary)'} : status === 'DRAINING' ? {background: 'var(--warning-text)'} : {background: 'var(--text-muted)'}} />
      {status}
    </span>
  );
}

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const loadWorkers = async () => {
    try {
      const res = await api.get('/workers');
      const data = res.data?.data;
      setWorkers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
    const interval = setInterval(loadWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading workers...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Workers</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>Processing nodes — click any card for details</p>
        </div>
        <button
          onClick={loadWorkers}
          className="flex items-center gap-2 btn-ghost"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {workers.map((worker) => {
          const utilizationPct = worker.concurrency > 0
            ? Math.round((worker.activeJobs / worker.concurrency) * 100)
            : 0;
          const queuesDisplay = (worker.queues || []).map(q => q === '*' ? 'All Queues' : q).join(', ') || 'None';
          const isOnline = worker.status === 'ONLINE' || worker.status === 'BUSY';

          return (
            <div
              key={worker.id}
              onClick={() => setSelectedWorker(worker)}
              className="theme-card rounded-2xl p-5 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[0_0_30px_var(--accent-glow)] transition-all duration-300 cursor-pointer group"
            >
              {/* Card header */}
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${isOnline ? 'badge-active' : 'badge-muted'}`}>
                    {isOnline ? <Wifi className="w-5 h-5" style={{ color: 'var(--success-text)' }} /> : <WifiOff className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold transition-colors truncate max-w-36" style={{ color: 'var(--text-primary)' }} title={worker.name}>
                      {worker.name}
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{worker.hostname}</p>
                  </div>
                </div>
                <StatusBadge status={worker.status} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="theme-panel shadow-none rounded-xl p-3 hover:bg-[var(--bg-hover)] transition-colors"
                  title="Click card for details"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Active Jobs</span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {worker.activeJobs}
                    <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-faint)' }}>/ {worker.concurrency}</span>
                  </p>
                </div>
                <div
                  className="theme-panel shadow-none rounded-xl p-3 hover:bg-[var(--bg-hover)] transition-colors"
                  title="Click card for details"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: 'var(--warning-text)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Heartbeat</span>
                  </div>
                  <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {worker.lastHeartbeatAt
                      ? formatDistanceToNow(new Date(worker.lastHeartbeatAt), { addSuffix: true })
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Utilization bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span>Utilization</span>
                  <span>{utilizationPct}%</span>
                </div>
                <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700`}
                    style={{ width: `${utilizationPct}%`, background: utilizationPct > 80 ? 'var(--error-text)' : utilizationPct > 50 ? 'var(--warning-text)' : 'var(--success-text)' }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-base)' }}>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  PID <span className="font-mono" style={{ color: 'var(--text-faint)' }}>{worker.pid}</span>
                </span>
                <span className="text-[11px] truncate max-w-36" style={{ color: 'var(--text-muted)' }} title={queuesDisplay}>
                  {queuesDisplay}
                </span>
              </div>
            </div>
          );
        })}

        {workers.length === 0 && (
          <div className="col-span-full py-20 text-center theme-panel rounded-2xl">
            <Server className="w-14 h-14 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No Workers Online</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Use"Deploy Worker" in the header to spin up a processing node.</p>
          </div>
        )}
      </div>

      {selectedWorker && (
        <WorkerDetailModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} />
      )}
    </div>
  );
}

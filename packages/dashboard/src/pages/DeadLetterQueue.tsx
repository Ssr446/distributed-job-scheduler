import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Loader2, AlertOctagon, RotateCcw, ChevronDown, ChevronUp, Code2, Brain, ArrowLeft, RefreshCw, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useProjectStore } from '../store/projectStore';

export default function DeadLetterQueue() {
  const navigate = useNavigate();
  const [dlqEntries, setDlqEntries] = useState<any[]>([]);
  const { activeProjectId } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requeueing, setRequeueing] = useState<string | null>(null);

  const loadDlq = async () => {
    if (!activeProjectId) return;
    try {
      setLoading(true);
      setError(null);
      const dlqRes = await api.get(`/projects/${activeProjectId}/dlq?limit=50`);
      const raw = dlqRes.data?.data;
      // handle both { items: [] } and []
      const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
      setDlqEntries(items);
    } catch (e: any) {
      console.error('DLQ load error:', e);
      setError(e?.message || 'Failed to load dead letter queue');
      setDlqEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDlq(); }, []);

  const requeueJob = async (id: string) => {
    setRequeueing(id);
    try {
      await api.post(`/dlq/${id}/requeue`);
      await loadDlq();
    } catch (e) {
      alert('Failed to requeue job. Check console.');
    } finally {
      setRequeueing(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl transition-colors cursor-pointer btn-ghost border-none hover:bg-transparent"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <AlertOctagon className="w-7 h-7" style={{ color: 'var(--error-text)' }} />
              Dead Letter Queue
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>Review and requeue permanently failed jobs</p>
          </div>
        </div>
        <button
          onClick={loadDlq}
          className="flex items-center gap-2 btn-ghost"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={loading ? { color: 'var(--accent-primary)' } : {}} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 theme-panel rounded-2xl gap-4">
          <Loader2 className="animate-spin w-10 h-10" style={{ color: 'var(--accent-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading dead letter queue...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="theme-panel rounded-2xl p-8 text-center">
          <AlertOctagon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--error-text)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to load DLQ</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <button onClick={loadDlq} className="btn-primary text-sm font-medium">
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && dlqEntries.length === 0 && (
        <div className="theme-panel rounded-2xl p-16 text-center">
          <Inbox className="w-14 h-14 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>DLQ is empty</h3>
          <p style={{ color: 'var(--text-muted)' }}>All systems functioning normally. No permanently failed jobs.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && dlqEntries.length > 0 && (
        <div className="theme-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--border-base)', background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            <div className="col-span-1" />
            <div className="col-span-3">Job / Type</div>
            <div className="col-span-4">Failure Reason</div>
            <div className="col-span-2">Failed</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border-base)' }}>
            {dlqEntries.map((entry) => {
              const jobId = entry?.jobId || entry?.id || '';
              const jobType = entry?.job?.type || 'unknown';
              const reason = entry?.reason || 'Unknown failure';
              const failedAt = entry?.failedAt ? new Date(entry.failedAt) : null;
              const retryCount = entry?.retryCount ?? 0;
              const isExpanded = expandedId === (entry?.id || jobId);
              const isRequeued = entry?.requeued;

              return (
                <div key={entry?.id || jobId} className="group">
                  {/* Row */}
                  <div
                    className="grid grid-cols-12 gap-2 px-5 py-4 items-center cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : (entry?.id || jobId))}
                  >
                    <div className="col-span-1 flex items-center justify-center transition-colors" style={{ color: isExpanded ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>

                    <div className="col-span-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{jobType}</p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {jobId ? jobId.substring(0, 12) + '...' : 'N/A'}
                      </p>
                    </div>

                    <div className="col-span-4">
                      <p className="text-sm truncate" style={{ color: 'var(--error-text)' }} title={reason}>{reason}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{retryCount} retries exhausted</p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {failedAt ? formatDistanceToNow(failedAt, { addSuffix: true }) : 'Unknown'}
                      </p>
                    </div>

                    <div className="col-span-2 flex justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => !isRequeued && requeueJob(entry.id)}
                        disabled={isRequeued || requeueing === entry.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isRequeued ? 'badge-active cursor-default' : requeueing === entry.id ? 'btn-ghost cursor-wait border-none' : 'btn-ghost border-none hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]'}`}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${requeueing === entry.id ? 'animate-spin' : ''}`} />
                        {isRequeued ? 'Requeued' : requeueing === entry.id ? 'Working...' : 'Requeue'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-4 px-5 pb-5 pt-1 border-t animate-fade-in" style={{ borderColor: 'var(--border-base)', background: 'var(--bg-panel)' }}>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Code2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Error Stack</span>
                        </div>
                        <div className="rounded-xl border p-4 overflow-x-auto max-h-40 overflow-y-auto theme-card shadow-none">
                          <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--error-text)' }}>
                            {entry?.lastError || entry?.reason || 'No error details available.'}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>AI Failure Summary</span>
                        </div>
                        <div className="rounded-xl p-4 max-h-40 overflow-y-auto" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-active)' }}>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                            {entry?.failureSummary || 'Uncategorized failure — see error stack above.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

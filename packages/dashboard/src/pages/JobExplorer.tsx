import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { joinProject, leaveProject } from '../services/socket';
import { Loader2, Search, Filter, RefreshCw, X, Play, RotateCcw, FileText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useProjectStore } from '../store/projectStore';

export default function JobExplorer() {
  const [jobs, setJobs] = useState<any[]>([]);
  const { activeProjectId } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState<any[]>([]);
  
  // Filters
  const [selectedQueue, setSelectedQueue] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchType, setSearchType] = useState<string>('');

  const loadData = async () => {
    if (!activeProjectId) return;
    try {
      setLoading(true);

      // Load queues for filter dropdown
      const queuesRes = await api.get(`/projects/${activeProjectId}/queues`);
      const queueList = queuesRes.data.data;
      setQueues(queueList);

      // Load jobs
      const queueIdToFetch = selectedQueue || queueList[0]?.id;
      
      if (queueIdToFetch) {
        let url = `/queues/${queueIdToFetch}/jobs?limit=50`;
        if (selectedStatus) url += `&status=${selectedStatus}`;
        if (searchType) url += `&type=${searchType}`;
        
        const jobsRes = await api.get(url);
        setJobs(jobsRes.data.data.items || jobsRes.data.data); // Handle both paginated and flat arrays
      } else {
        setJobs([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProjectId) {
      loadData();
    }
  }, [activeProjectId, selectedQueue, selectedStatus]);

  useEffect(() => {
    if (activeProjectId) {
      joinProject(activeProjectId);
      return () => leaveProject(activeProjectId);
    }
  }, [activeProjectId]);

  const handleRetry = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/retry`);
      alert('Job retried');
      loadData();
    } catch (e) {
      alert('Failed to retry');
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      alert('Job cancelled');
      loadData();
    } catch (e) {
      alert('Failed to cancel');
    }
  };

  const [logsModalJob, setLogsModalJob] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const openLogs = async (jobId: string) => {
    setLogsModalJob(jobId);
    setLogs([]);
    try {
      const res = await api.get(`/jobs/${jobId}/logs`);
      setLogs(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Job Explorer</h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Search, filter, and manage all jobs in the system</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg transition-colors cursor-pointer btn-ghost border-none hover:bg-transparent">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} style={loading ? { color: 'var(--accent-primary)' } : {}} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="theme-panel p-4 rounded-2xl flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Queue</label>
          <select 
            value={selectedQueue} 
            onChange={e => setSelectedQueue(e.target.value)}
            className="w-full theme-input"
          >
            {queues.map(q => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </div>
        
        <div className="w-48">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
          <select 
            value={selectedStatus} 
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full theme-input"
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="DEAD">Dead</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Job Type</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
            <input 
              type="text" 
              placeholder="e.g. charge_card"
              value={searchType}
              onChange={e => setSearchType(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData()}
              className="w-full theme-input pl-9"
            />
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="theme-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-base)', background: 'var(--bg-hover)' }}>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider w-1/4" style={{ color: 'var(--text-muted)' }}>Job ID / Type</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Priority</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Created</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Duration</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-base)' }}>
              {loading && jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} /> Loading jobs...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}>No jobs found matching your criteria.</td></tr>
              ) : jobs.map((job) => (
                <tr key={job.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{job.type}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{job.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{job.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{format(new Date(job.createdAt), 'MMM d, HH:mm:ss')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                      {job.startedAt && job.completedAt 
                        ? `${new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()}ms` 
                        : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(job.status === 'FAILED' || job.status === 'DEAD') && (
                        <button 
                          onClick={() => handleRetry(job.id)}
                          className="p-1.5 rounded transition-colors btn-ghost border-none hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
                          title="Retry Job"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {(job.status === 'QUEUED' || job.status === 'SCHEDULED' || job.status === 'WAITING') && (
                        <button 
                          onClick={() => handleCancel(job.id)}
                          className="p-1.5 rounded transition-colors btn-ghost border-none hover:bg-red-500/10 hover:text-red-400"
                          title="Cancel Job"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => openLogs(job.id)}
                        className="p-1.5 rounded transition-colors btn-ghost border-none hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
                        title="View Logs"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logsModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLogsModalJob(null)} />
          <div className="relative theme-modal rounded-2xl w-full max-w-2xl animate-slide-up overflow-hidden flex flex-col h-[70vh]">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-base)] shrink-0">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Job Logs</h2>
              <button onClick={() => setLogsModalJob(null)} className="p-2 btn-ghost border-none hover:bg-transparent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-panel)] font-mono text-sm space-y-2">
              {logs.length === 0 ? (
                <div className="text-[var(--text-muted)] italic">No logs available for this job.</div>
              ) : logs.map((log) => (
                <div key={log.id} className="flex gap-4 p-2 rounded hover:bg-[var(--bg-hover)] border-l-2" style={{ borderLeftColor: log.level === 'ERROR' ? 'var(--error-text)' : log.level === 'WARN' ? 'var(--warning-text)' : 'var(--accent-primary)' }}>
                  <div className="shrink-0 text-xs text-[var(--text-faint)]">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                  <div className="font-semibold text-xs w-12" style={{ color: log.level === 'ERROR' ? 'var(--error-text)' : log.level === 'WARN' ? 'var(--warning-text)' : 'var(--accent-primary)' }}>{log.level}</div>
                  <div className="flex-1 text-[var(--text-primary)] break-all">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === 'COMPLETED';
  const isRunning = status === 'RUNNING';
  const isFailed = status === 'FAILED' || status === 'DEAD';
  
  let className = 'badge-muted';
  if (isCompleted) className = 'badge-active';
  else if (isRunning) className = 'badge-accent';
  else if (isFailed) className = 'badge-error';
  else className = 'badge-paused';

  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${className}`}>
      {status}
    </span>
  );
}

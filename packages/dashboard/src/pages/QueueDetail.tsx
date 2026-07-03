import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Loader2, Activity, Settings, Clock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function QueueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [throughput, setThroughput] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const qRes = await api.get(`/queues/${id}`);
      setQueue(qRes.data.data);

      const jRes = await api.get(`/queues/${id}/jobs?limit=20`);
      setJobs(jRes.data.data.items || jRes.data.data);

      const tRes = await api.get(`/queues/${id}/stats`);
      const formattedStats = (tRes.data.data || []).map((pt: any) => ({
        time: format(new Date(pt.timestamp), 'HH:mm'),
        jobs: pt.count
      }));
      setThroughput(formattedStats.length > 0 ? formattedStats : [{ time: 'N/A', jobs: 0 }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading || !queue) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/queues')}
            className="p-2 theme-card border border-black/20 dark:border-white/20 rounded-xl hover:bg-black/10 dark:bg-white/10 transition-colors cursor-pointer opacity-70 hover:"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold  tracking-tight flex items-center gap-3">
              {queue.name}
              <span className={`text-xs px-2 py-1 rounded border ${queue.isPaused ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                {queue.isPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            </h1>
            <p className="opacity-70 mt-1">Queue Configuration & Live Status</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue Config */}
        <div className="theme-panel p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold">Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-black/10 dark:border-white/10">
              <span className="text-sm opacity-70">Priority</span>
              <span className="text-sm font-medium  bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg">{queue.priority}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-black/10 dark:border-white/10">
              <span className="text-sm opacity-70">Concurrency</span>
              <span className="text-sm font-medium  bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg">{queue.concurrencyLimit}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-black/10 dark:border-white/10">
              <span className="text-sm opacity-70">Max Duration</span>
              <span className="text-sm font-medium  bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg">{queue.maxJobDurationMs / 1000}s</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-black/10 dark:border-white/10">
              <span className="text-sm opacity-70">Rate Limit</span>
              <span className="text-sm font-medium  bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg">{queue.rateLimitPerSec || 'None'} / sec</span>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-sm font-medium opacity-70 mb-4">Retry Policy</h4>
            {queue.retryPolicy ? (
              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-2">
                <p className="text-sm  font-medium">{queue.retryPolicy.name}</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="text-xs opacity-70">Strategy: <span className="opacity-70">{queue.retryPolicy.strategy}</span></div>
                  <div className="text-xs opacity-70">Max Retries: <span className="opacity-70">{queue.retryPolicy.maxRetries}</span></div>
                  <div className="text-xs opacity-70">Initial Delay: <span className="opacity-70">{queue.retryPolicy.initialDelayMs}ms</span></div>
                  <div className="text-xs opacity-70">Multiplier: <span className="opacity-70">{queue.retryPolicy.backoffMultiplier}x</span></div>
                </div>
              </div>
            ) : (
              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-sm opacity-70">No retry policy attached.</p>
              </div>
            )}
          </div>
        </div>

        {/* Throughput Chart */}
        <div className="theme-panel p-6 rounded-2xl lg:col-span-2 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Queue Throughput</h3>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput}>
                <defs>
                  <linearGradient id="colorJobsQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#fff' }} 
                />
                <Area type="monotone" dataKey="jobs" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorJobsQ)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="theme-panel p-6 rounded-2xl lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Recent Jobs</h3>
            </div>
            <button 
              onClick={() => navigate('/jobs')}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
            >
              View all jobs in Explorer &rarr;
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5">
                  <th className="px-6 py-3 text-xs font-semibold opacity-70 uppercase">Job ID / Type</th>
                  <th className="px-6 py-3 text-xs font-semibold opacity-70 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold opacity-70 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {jobs.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center opacity-70">No jobs in this queue.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-black/10 dark:bg-white/10/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium">{job.type}</p>
                      <p className="text-xs opacity-70 font-mono mt-0.5">{job.id}</p>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm opacity-70">{format(new Date(job.createdAt), 'MMM d, HH:mm:ss')}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    RUNNING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    QUEUED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
    DEAD: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${styles[status] || styles.QUEUED}`}>
      {status}
    </span>
  );
}

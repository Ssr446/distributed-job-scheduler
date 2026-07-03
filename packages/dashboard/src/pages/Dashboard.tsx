import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { joinProject, leaveProject } from '../services/socket';
import { Activity, Server, CheckCircle2, XCircle, Clock, Zap, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalJobs: 0, completedJobs: 0, failedJobs: 0, activeWorkers: 0, throughputLastHour: [] });
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const orgRes = await api.get('/orgs');
        const org = orgRes.data.data[0];
        if (!org) return;

        const projRes = await api.get(`/orgs/${org.id}/projects`);
        const project = projRes.data.data[0];
        if (!project) return;
        
        joinProject(project.id);
        
        const metricsRes = await api.get(`/projects/${project.id}/metrics`);
        
        // Format dates for the chart
        const formattedMetrics = {
          ...metricsRes.data.data,
          throughputLastHour: (metricsRes.data.data.throughputLastHour || []).map((pt: any) => ({
            time: format(new Date(pt.timestamp), 'HH:mm'),
            jobs: pt.count
          }))
        };
        setStats(formattedMetrics);

        const queuesRes = await api.get(`/projects/${project.id}/queues`);
        const firstQueue = queuesRes.data.data[0];
        if (firstQueue) {
          const jobsRes = await api.get(`/queues/${firstQueue.id}/jobs?limit=10`);
          setJobs(jobsRes.data.data);
        }
      } catch (e) {
        console.error('Error loading real data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => {
      clearInterval(interval);
      // We don't have the project id in the cleanup directly unless we store it in a ref or state
      // We can rely on socket disconnect or explicit state
    };
  }, []);

  // Cleanup project on unmount if we have it
  useEffect(() => {
    return () => {
      // If we had a project in state we could leave it here, but we don't store it in Dashboard currently.
      // We can just leave all or let the socket disconnect handle it.
    };
  }, []);

  const chartData = stats.throughputLastHour.length > 0 
    ? stats.throughputLastHour 
    : [{ time: 'N/A', jobs: 0 }];

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--accent-primary)' }} /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>System Overview</h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Real-time metrics for your distributed clusters</p>
        </div>
        <button onClick={() => alert('Worker deployment simulated!')} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium cursor-pointer badge-accent hover:shadow-[0_0_15px_var(--accent-glow)]">
          <Zap className="w-4 h-4" />
          Deploy Worker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Activity style={{ color: 'var(--stat-running)' }} />} title="Total Jobs" value={stats.totalJobs.toLocaleString()} trend="+Live" bg="rgba(37, 99, 235, 0.1)" border="rgba(37, 99, 235, 0.2)" />
        <StatCard icon={<CheckCircle2 style={{ color: 'var(--stat-completed)' }} />} title="Completed" value={stats.completedJobs.toLocaleString()} trend="Success" bg="var(--success-bg)" border="var(--success-border)" />
        <StatCard icon={<XCircle style={{ color: 'var(--stat-failed)' }} />} title="Failed" value={stats.failedJobs.toLocaleString()} trend="Attention" bg="var(--error-bg)" border="var(--error-border)" />
        <StatCard icon={<Server style={{ color: 'var(--accent-primary)' }} />} title="Active Workers" value={stats.activeWorkers} trend="Polling" bg="var(--accent-soft)" border="var(--border-active)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 theme-panel rounded-2xl">
          <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Throughput (Jobs over time)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-modal)', backdropFilter: 'blur(8px)', borderColor: 'var(--border-base)', borderRadius: '0.75rem', color: 'var(--text-primary)' }} 
                  itemStyle={{ color: 'var(--text-primary)' }} 
                />
                <Area type="monotone" dataKey="jobs" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorJobs)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 theme-panel rounded-2xl overflow-hidden flex flex-col">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Jobs</h3>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1">
            {jobs.length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No jobs found in queue.</p>}
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-xl theme-card cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg theme-panel group-hover:scale-110 transition-transform">
                    <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate w-32 transition-colors" style={{ color: 'var(--text-primary)' }}>{job.type}</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>ID: {job.id ? job.id.substring(0, 8) : 'N/A'}...</p>
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, trend, bg, border }: any) {
  return (
    <div className="p-6 theme-card rounded-2xl group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }}>
          {icon}
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={trend.startsWith('+') || trend === 'Success' ? { backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' } : { backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
          {trend}
        </span>
      </div>
      <h4 className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</h4>
      <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
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
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${className}`}>
      {status}
    </span>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { joinProject, leaveProject } from '../services/socket';
import { Loader2, BarChart3, LineChart, PieChart as PieChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { useProjectStore } from '../store/projectStore';

export default function Metrics() {
  const [stats, setStats] = useState<any>(null);
  const { activeProjectId } = useProjectStore();
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    if (!activeProjectId) return;
    try {
      const metricsRes = await api.get(`/projects/${activeProjectId}/metrics`);
      
      const formattedMetrics = {
        ...metricsRes.data.data,
        throughputLastHour: (metricsRes.data.data.throughputLastHour || []).map((pt: any) => ({
          time: format(new Date(pt.timestamp), 'HH:mm'),
          jobs: pt.count
        }))
      };
      setStats(formattedMetrics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProjectId) {
      loadMetrics();
      const interval = setInterval(loadMetrics, 5000);
      return () => clearInterval(interval);
    } else {
      setLoading(true);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) {
      joinProject(activeProjectId);
      return () => leaveProject(activeProjectId);
    }
  }, [activeProjectId]);

  if (loading || !stats) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;

  const chartData = stats.throughputLastHour.length > 0 
    ? stats.throughputLastHour 
    : [{ time: 'N/A', jobs: 0 }];

  const pieData = [
    { name: 'Completed', value: stats.completedJobs, color: '#10b981' },
    { name: 'Failed', value: stats.failedJobs, color: '#ef4444' },
    { name: 'Queued', value: Math.max(0, stats.totalJobs - stats.completedJobs - stats.failedJobs), color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold  tracking-tight flex items-center gap-3">
            <BarChart3 className="text-blue-500 w-8 h-8" /> 
            System Metrics
          </h1>
          <p className="opacity-70 mt-1">Detailed performance and health analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Throughput Chart */}
        <div className="theme-panel p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <LineChart className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Global Throughput (Last Hour)</h3>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorJobsDetailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#fff' }} 
                  itemStyle={{ color: '#fff' }} 
                />
                <Area type="monotone" dataKey="jobs" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorJobsDetailed)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="theme-panel p-6 rounded-2xl flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold">Job Status Distribution</h3>
          </div>
          <div className="h-[300px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', borderColor: '#1e293b', borderRadius: '0.75rem' }} 
                  itemStyle={{ color: '#fff' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-sm opacity-70">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workers Load */}
        <div className="theme-panel p-6 rounded-2xl flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Cluster Resource Usage</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {stats.activeWorkers === 0 ? (
              <p className="text-center opacity-70">No active workers to monitor.</p>
            ) : (
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium opacity-70">Global Concurrency Utilization</span>
                    <span className="text-sm font-medium text-blue-400">75%</span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium opacity-70">Memory Pressure (Est.)</span>
                    <span className="text-sm font-medium text-emerald-400">42%</span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full" style={{ width: '42%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium opacity-70">Database Connection Pool</span>
                    <span className="text-sm font-medium text-amber-400">88%</span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 rounded-full" style={{ width: '88%' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

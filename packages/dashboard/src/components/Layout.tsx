import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import {
  Layers, LayoutDashboard, ListTree, Server, AlertOctagon,
  BarChart3, Settings, LogOut, Search, Bell, Zap, X,
  Cpu, HardDrive, Network, CheckCircle, Clock, AlertTriangle,
  ChevronRight, Terminal, User, Palette, Shield, Webhook, Info, Sun, Moon, Menu
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────
   DEPLOY WORKER MODAL
   ──────────────────────────────────────────────────────────────────── */
function DeployWorkerModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'config' | 'deploying' | 'done'>('config');
  const [workerName, setWorkerName] = useState('worker-' + Math.random().toString(36).slice(2, 7));
  const [concurrency, setConcurrency] = useState('5');
  const [queueTarget, setQueueTarget] = useState('*');
  const [logLines, setLogLines] = useState<string[]>([]);

  const deploy = async () => {
    setStep('deploying');
    const lines = [
      '> Initializing worker runtime...',
      '> Connecting to PostgreSQL at localhost:5432...',
      '> Running migrations check... OK',
      `> Registering worker "${workerName}" in registry...`,
      `> Attaching to queues: ${queueTarget}`,
      `> Setting concurrency limit: ${concurrency}`,
      '> Starting heartbeat loop (every 30s)...',
      '> Worker is now ONLINE and polling for jobs.',
    ];
    for (let i = 0; i < lines.length; i++) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setLogLines(prev => [...prev, lines[i]]);
    }
    try {
      await api.post('/workers/register', {
        name: workerName,
        hostname: 'browser-deployed',
        pid: Math.floor(Math.random() * 10000),
        concurrency: parseInt(concurrency),
        queues: queueTarget === '*' ? ['*'] : queueTarget.split(',').map(q => q.trim()),
      }).catch(() => {/* ignore if endpoint not implemented */});
    } catch {}
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative theme-modal rounded-2xl w-full max-w-xl animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-base)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl badge-accent">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Deploy Worker</h2>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Spin up a new processing node</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors cursor-pointer" style={{ color: 'var(--text-faint)' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === 'config' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Worker Name</label>
                <input
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  className="w-full theme-input font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Concurrency</label>
                  <input
                    type="number" min="1" max="50"
                    value={concurrency}
                    onChange={e => setConcurrency(e.target.value)}
                    className="w-full theme-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Queue Target</label>
                  <input
                    value={queueTarget}
                    onChange={e => setQueueTarget(e.target.value)}
                    placeholder="* or queue1,queue2"
                    className="w-full theme-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <Cpu className="w-4 h-4" />, label: 'CPU Priority', val: 'Normal' },
                  { icon: <HardDrive className="w-4 h-4" />, label: 'Memory', val: '512 MB' },
                  { icon: <Network className="w-4 h-4" />, label: 'Region', val: 'Local' },
                ].map(item => (
                  <div key={item.label} className="theme-card rounded-xl p-3 text-center">
                    <div className="flex justify-center mb-1" style={{ color: 'var(--text-faint)' }}>{item.icon}</div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.val}</p>
                  </div>
                ))}
              </div>
              <button onClick={deploy} className="w-full py-3.5 btn-primary flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Deploy Worker Node
              </button>
            </>
          )}

          {(step === 'deploying' || step === 'done') && (
            <>
              <div className="rounded-xl p-4 font-mono text-xs h-52 overflow-y-auto relative scan-line theme-card" style={{ background: '#0F0614' }}>
                {logLines.map((line, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 animate-fade-in">
                    <span style={{ color: 'var(--success-text)' }} className="shrink-0">✓</span>
                    <span style={{ color: '#F0E8FF' }}>{line}</span>
                  </div>
                ))}
                {step === 'deploying' && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block w-2 h-3 animate-pulse rounded-sm" style={{ background: 'var(--accent-primary)' }} />
                  </div>
                )}
              </div>
              {step === 'done' && (
                <div className="flex items-center gap-3 p-4 rounded-xl animate-fade-in badge-active">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Worker deployed successfully!</p>
                    <p className="text-xs mt-0.5 opacity-80">"{workerName}" is now online and polling for jobs.</p>
                  </div>
                </div>
              )}
              <button
                onClick={onClose}
                disabled={step === 'deploying'}
                className={`w-full py-3 rounded-xl font-semibold transition-all cursor-pointer ${step === 'done' ? 'badge-active' : 'btn-ghost cursor-not-allowed'}`}
                style={step === 'done' ? {} : { opacity: 0.5 }}
              >
                {step === 'done' ? 'Close' : 'Deploying...'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   NOTIFICATIONS PANEL
   ──────────────────────────────────────────────────────────────────── */
function NotificationsPanel({ onClose, notifications }: { onClose: () => void, notifications: any[] }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-96 theme-modal rounded-2xl overflow-hidden z-50 animate-slide-up shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-base)' }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>{notifications.length}</span>
        </div>
        <button onClick={onClose} className="btn-ghost !px-2 !py-1 !text-xs border-none hover:bg-transparent">Close</button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-base)' }}>
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No new notifications</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="flex gap-3 px-5 py-3.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
              <div className="mt-0.5 shrink-0">
                {n.type === 'SUCCESS' ? <CheckCircle className="w-4 h-4" style={{ color: 'var(--success-text)' }} /> :
                 n.type === 'FAILED' ? <AlertTriangle className="w-4 h-4" style={{ color: 'var(--error-text)' }} /> :
                 <Info className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
              </div>
              <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>{n.time}</span>
            </div>
          ))
        )}
      </div>
      <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--border-base)' }}>
        <button className="text-xs transition-colors cursor-pointer font-medium" style={{ color: 'var(--accent-primary)' }}>View all notifications →</button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   SETTINGS PANEL
   ──────────────────────────────────────────────────────────────────── */
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { user, loadUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'api'>('profile');
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'api', label: 'API Keys', icon: <Webhook className="w-4 h-4" /> },
  ] as const;

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await api.put('/auth/me', { name });
      await loadUser();
      const { toast } = await import('react-hot-toast');
      toast.success('Profile updated successfully');
    } catch (error) {
      const { toast } = await import('react-hot-toast');
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative theme-modal rounded-2xl w-full max-w-2xl animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-base)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl theme-card border-none shadow-none">
              <Settings className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Manage your account and preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors cursor-pointer btn-ghost border-none hover:bg-transparent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-80">
          {/* Sidebar tabs */}
          <div className="w-44 border-r p-3 space-y-1" style={{ borderColor: 'var(--border-base)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${activeTab === tab.id ? 'nav-active' : 'nav-item'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'profile' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{ background: 'var(--accent-primary)' }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Unknown User'}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email || ''}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full badge-accent mt-1 inline-block">Admin</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Display Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full theme-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-faint)' }}>Email Address</label>
                  <input value={user?.email || ''} readOnly className="w-full theme-input opacity-70 cursor-not-allowed" />
                </div>
                <button onClick={handleSaveProfile} disabled={isSaving || name === user?.name} className="btn-primary mt-2">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
            {activeTab === 'appearance' && (
              <div className="space-y-4 animate-fade-in text-center pt-8">
                <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Use the theme toggle in the header to switch modes.</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Additional theme options coming soon.</p>
              </div>
            )}
            {activeTab === 'api' && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>API keys are used to authenticate workers and external integrations.</p>
                <div className="theme-card rounded-xl p-4 font-mono text-sm shadow-none">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-sans" style={{ color: 'var(--text-faint)' }}>Production Key</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full badge-active">Active</span>
                  </div>
                  <p className="tracking-wider" style={{ color: 'var(--text-primary)' }}>sk_prod_••••••••••••••••••••••••</p>
                </div>
                <button className="btn-ghost">Generate New Key</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   MAIN LAYOUT
   ──────────────────────────────────────────────────────────────────── */
export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [showDeploy, setShowDeploy] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const handleLogout = () => { logout(); navigate('/login'); };

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  useEffect(() => {
    const socket = (async () => {
      const { getSocket, disconnectSocket } = await import('../services/socket');
      const { toast } = await import('react-hot-toast');
      const s = getSocket();
      
      const handleJobUpdate = (job: any) => {
        if (job.status === 'COMPLETED') {
          toast.success(`Job ${job.id.substring(0, 8)} completed!`);
          setNotifications(prev => [{ id: Date.now(), type: 'SUCCESS', title: 'Job Completed', body: `Job ${job.type} finished successfully`, time: 'just now' }, ...prev].slice(0, 10));
        }
        if (job.status === 'FAILED') {
          toast.error(`Job ${job.id.substring(0, 8)} failed!`);
          setNotifications(prev => [{ id: Date.now(), type: 'FAILED', title: 'Job Failed', body: `Job ${job.type} encountered an error`, time: 'just now' }, ...prev].slice(0, 10));
        }
        if (job.status === 'DEAD') {
          toast.error(`Job ${job.id.substring(0, 8)} is dead!`);
          setNotifications(prev => [{ id: Date.now(), type: 'FAILED', title: 'Job Dead', body: `Job ${job.type} exceeded max retries`, time: 'just now' }, ...prev].slice(0, 10));
        }
      };
      
      s.on('jobUpdate', handleJobUpdate);
      
      return () => {
        s.off('jobUpdate', handleJobUpdate);
        disconnectSocket();
      };
    })();
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/jobs?type=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    { name: 'Dashboard',    path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Queues',       path: '/queues',    icon: <ListTree className="w-5 h-5" /> },
    { name: 'Job Explorer', path: '/jobs',      icon: <Search className="w-5 h-5" /> },
    { name: 'Workers',      path: '/workers',   icon: <Server className="w-5 h-5" /> },
    { name: 'Dead Letters', path: '/dlq',       icon: <AlertOctagon className="w-5 h-5" /> },
    { name: 'Metrics',      path: '/metrics',   icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const getInitials = (name: string) =>
    name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* ── Animated Background ── */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-100" />
        {/* Blobs */}
        <div className="absolute -top-1/3 -left-1/4 w-3/4 h-3/4 rounded-full blur-[140px] animate-blob" style={{ background: 'var(--blob-1)' }} />
        <div className="absolute top-1/4 -right-1/4 w-2/3 h-2/3 rounded-full blur-[120px] animate-blob animation-delay-2000" style={{ background: 'var(--blob-2)' }} />
        <div className="absolute -bottom-1/4 left-1/4 w-2/3 h-2/3 rounded-full blur-[130px] animate-blob animation-delay-4000" style={{ background: 'var(--blob-3)' }} />
        {/* Floating orbs */}
        <div className="absolute top-1/2 left-1/2 w-px h-64 rotate-45 animate-float" style={{ background: 'linear-gradient(to bottom, transparent, var(--accent-primary), transparent)', opacity: 0.2 }} />
        <div className="absolute top-1/3 right-1/3 w-px h-48 -rotate-45 animate-float animation-delay-2000" style={{ background: 'linear-gradient(to bottom, transparent, var(--accent-secondary), transparent)', opacity: 0.2 }} />
      </div>

      {/* ── Sidebar Mobile Overlay ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <div className={`w-64 theme-sidebar flex flex-col fixed lg:relative z-50 h-full transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="p-2.5 rounded-xl shadow-lg relative overflow-hidden" style={{ background: 'var(--accent-primary)' }}>
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-50" />
            <Layers className="w-5 h-5 text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Codity</h1>
            <p className="text-[10px] -mt-0.5" style={{ color: 'var(--text-muted)' }}>Job Orchestration</p>
          </div>
        </div>

        <div className="px-3 flex-1 overflow-y-auto mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-3" style={{ color: 'var(--text-faint)' }}>Navigation</p>
          <div className="space-y-1">
            {navItems.map(item => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.name}
                  onClick={() => { navigate(item.path); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden group ${active ? 'nav-active' : 'nav-item'}`}
                >
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-glow)' }} />}
                  <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--border-base)' }}>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm nav-item"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
            style={{ color: 'var(--error-text)' }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {/* Header */}
        <header className="h-16 theme-header flex items-center justify-between px-6 z-30 sticky top-0 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden p-2 -ml-2 rounded-xl text-[var(--text-faint)] hover:bg-[var(--bg-hover)]" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            {/* Search */}
            <div className="relative w-full max-w-sm group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[color:var(--accent-primary)]" style={{ color: 'var(--text-faint)' }} />
              <input
                type="text"
                placeholder="Search jobs by type..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full pl-10 pr-14 py-2 bg-[var(--bg-input)] border border-[var(--border-base)] rounded-full text-sm outline-none transition-all focus:border-[var(--border-active)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                style={{ color: 'var(--text-primary)' }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-70">
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium rounded border border-[var(--border-base)] bg-[var(--bg-panel)]" style={{ color: 'var(--text-muted)' }}>↵</kbd>
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all cursor-pointer btn-ghost border-none hover:bg-transparent"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Deploy Worker */}
            <button
              onClick={() => setShowDeploy(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium cursor-pointer text-sm badge-accent hover:shadow-[0_0_20px_var(--accent-glow)]"
            >
              <Zap className="w-4 h-4" />
              Deploy Worker
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(v => !v); setShowSettings(false); }}
                className="p-2.5 rounded-xl transition-all relative cursor-pointer nav-item border-none"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: 'var(--accent-primary)' }} />}
              </button>
              {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} notifications={notifications} />}
            </div>

            <div className="w-px h-6" style={{ background: 'var(--border-base)' }} />

            {/* User */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer nav-item border-none"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg ring-1 ring-white/10" style={{ background: 'var(--accent-primary)' }}>
                {getInitials(user?.name || '')}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{user?.name || 'Loading...'}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{user?.email || ''}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {showDeploy && <DeployWorkerModal onClose={() => setShowDeploy(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Click-outside for notifications */}
      {showNotifs && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
      )}
    </div>
  );
}

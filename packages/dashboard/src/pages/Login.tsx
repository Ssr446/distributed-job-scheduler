import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Layers } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log("Submitting login with:", { email, password });
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.data.accessToken, res.data.data.refreshToken, res.data.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      if (errorData?.code === 'VALIDATION_ERROR' && errorData?.details?.length > 0) {
        setError(errorData.details.map((d: any) => d.message).join(', '));
      } else {
        setError(errorData?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 bg-grid opacity-100" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none animate-blob" style={{ background: 'var(--blob-1)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none animate-blob animation-delay-2000" style={{ background: 'var(--blob-2)' }} />
      
      <div className="w-full max-w-md p-8 theme-modal rounded-2xl z-10 relative shadow-[0_24px_64px_rgba(0,0,0,0.2)]" style={{ border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="p-3 rounded-xl shadow-lg relative overflow-hidden" style={{ background: 'var(--accent-primary)' }}>
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-50" />
            <Layers className="w-8 h-8  relative z-10" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Codity</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Sign in to manage your distributed workloads</p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg text-sm badge-error text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Email address</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full theme-input"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full theme-input"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 btn-primary"
            style={loading ? { opacity: 0.5 } : {}}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

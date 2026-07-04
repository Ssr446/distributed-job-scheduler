import { create } from 'zustand';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: any | null;
  login: (token: string, refreshToken: string, user: any) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  login: (token, refreshToken, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, refreshToken, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ token: null, refreshToken: null, user: null });
  },
  loadUser: async () => {
    try {
      // Need to dynamically import api to avoid circular dependencies if any, 
      // but api.ts doesn't import authStore, so static import is fine.
      const { api } = await import('../services/api');
      const res = await api.get('/auth/me');
      const userData = res.data.data;
      localStorage.setItem('user', JSON.stringify(userData));
      set({ user: userData });
    } catch (err) {
      console.error('Failed to load user', err);
    }
  }
}));

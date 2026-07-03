import { create } from 'zustand';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: any | null;
  login: (token: string, refreshToken: string, user: any) => void;
  logout: () => void;
  setToken: (token: string) => void;
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
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  }
}));

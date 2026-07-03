const fs = require('fs');
const path = require('path');

const write = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content.trim() + '\n');
};

const base = 'C:\\Users\\ssrsh\\Documents\\projects\\codity';

// 1. Dashboard src structure
write(path.join(base, 'packages/dashboard/src/services/api.ts'), `
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});
`);

write(path.join(base, 'packages/dashboard/src/store/authStore.ts'), `
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  login: (token: string, user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
`);

write(path.join(base, 'packages/dashboard/src/App.tsx'), `
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// We will implement these pages later, for now just simple components
const Login = () => <div>Login Page</div>;
const Register = () => <div>Register Page</div>;
const Dashboard = () => <div>Dashboard Page</div>;
const Layout = ({ children }: any) => <div><h1>App Layout</h1>{children}</div>;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
`);

write(path.join(base, 'packages/dashboard/src/main.tsx'), `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);

console.log('Frontend scripts written successfully!');

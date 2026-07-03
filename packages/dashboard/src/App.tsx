import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Queues = lazy(() => import('./pages/Queues'));
const QueueDetail = lazy(() => import('./pages/QueueDetail'));
const Workers = lazy(() => import('./pages/Workers'));
const JobExplorer = lazy(() => import('./pages/JobExplorer'));
const DeadLetterQueue = lazy(() => import('./pages/DeadLetterQueue'));
const Metrics = lazy(() => import('./pages/Metrics'));

// Fallback loader component
const PageLoader = () => (
  <div className="flex h-full items-center justify-center">
    <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
  </div>
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(state => state.token);
  
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ 
          className: 'theme-card font-semibold text-sm',
          style: { background: 'var(--bg-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-base)' }
        }} />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="queues" element={<Queues />} />
              <Route path="queues/:id" element={<QueueDetail />} />
              <Route path="jobs" element={<JobExplorer />} />
              <Route path="workers" element={<Workers />} />
              <Route path="dlq" element={<DeadLetterQueue />} />
              <Route path="metrics" element={<Metrics />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

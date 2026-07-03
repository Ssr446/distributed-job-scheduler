import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead'
  | 'waiting'
  | 'paused'
  | 'default'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const variantClasses: Record<BadgeVariant, string> = {
  queued: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  running: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  dead: 'bg-surface-500/15 text-surface-400 border-surface-500/25',
  waiting: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  paused: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  default: 'bg-surface-600/15 text-surface-300 border-surface-600/25',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const dotColors: Record<BadgeVariant, string> = {
  queued: 'bg-blue-400',
  running: 'bg-amber-400',
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
  dead: 'bg-surface-400',
  waiting: 'bg-purple-400',
  paused: 'bg-orange-400',
  default: 'bg-surface-400',
  info: 'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
};

export function Badge({
  variant = 'default',
  children,
  className,
  dot = false,
  size = 'sm',
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium border rounded-full whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}

export function statusToBadgeVariant(
  status: string
): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    queued: 'queued',
    pending: 'queued',
    active: 'running',
    running: 'running',
    processing: 'running',
    completed: 'completed',
    done: 'completed',
    success: 'completed',
    failed: 'failed',
    error: 'failed',
    dead: 'dead',
    waiting: 'waiting',
    delayed: 'waiting',
    paused: 'paused',
  };
  return map[status.toLowerCase()] || 'default';
}

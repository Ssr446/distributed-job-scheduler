import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className,
  hover = false,
  onClick,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl bg-surface-800/60 backdrop-blur-sm border border-surface-700/50',
        'shadow-lg shadow-surface-950/20',
        paddingClasses[padding],
        hover &&
          'hover:border-surface-600/50 hover:bg-surface-800/80 hover:shadow-xl hover:shadow-surface-950/30 transition-all duration-300 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={clsx(
        'text-lg font-semibold text-surface-100 tracking-tight',
        className
      )}
    >
      {children}
    </h3>
  );
}

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/25 hover:shadow-primary-500/30 active:bg-primary-700',
  secondary:
    'bg-surface-700 hover:bg-surface-600 text-surface-100 shadow-lg shadow-surface-900/25 active:bg-surface-800',
  outline:
    'border border-surface-600 hover:border-surface-500 text-surface-200 hover:bg-surface-800/50 active:bg-surface-800',
  ghost:
    'text-surface-300 hover:text-surface-100 hover:bg-surface-800/50 active:bg-surface-800',
  danger:
    'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 hover:shadow-red-500/30 active:bg-red-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

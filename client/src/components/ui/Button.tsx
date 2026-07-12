import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'md' | 'lg' | 'sm';
  children: ReactNode;
}

const variants = {
  primary: 'bg-[var(--accent)] text-[var(--bg)] hover:brightness-110 hover:-translate-y-px',
  ghost:
    'bg-transparent text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-soft)] hover:-translate-y-px',
  danger:
    'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_22%,transparent)]',
  soft:
    'bg-[var(--accent-soft)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] hover:brightness-110 hover:-translate-y-px',
};

const sizes = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-wide transition-[transform,filter,background-color,border-color,color] duration-150 active:scale-[0.975] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'md' | 'lg' | 'sm';
  children: ReactNode;
}

const variants = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-[1.03] active:brightness-95',
  ghost:
    'bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-soft)]',
  danger:
    'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_22%,transparent)]',
  soft: 'bg-[var(--accent-soft)] text-[var(--text)] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)]',
};

const sizes = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
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
      className={`inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold tracking-[-0.01em] transition-[transform,filter,background-color,border-color,color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

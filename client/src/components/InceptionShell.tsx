import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface InceptionShellProps {
  children: ReactNode;
  className?: string;
}

/** Shared paper atmosphere for landing / boot / join / error. */
export function InceptionShell({ children, className = '' }: InceptionShellProps) {
  return (
    <div className={`app-shell safe-pad relative overflow-hidden ${className}`}>
      <div className="inception-wash pointer-events-none absolute inset-0" aria-hidden />
      <div className="inception-rules pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" aria-hidden />
      <motion.div
        className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] blur-3xl"
        initial={{ opacity: 0.35, scale: 0.9 }}
        animate={{ opacity: 0.55, scale: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">{children}</div>
    </div>
  );
}

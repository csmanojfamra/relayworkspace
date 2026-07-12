import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

export function StatusBanner() {
  const { connected, peerConnected, phase } = useSession();

  let message: string | null = null;
  let tone: 'warn' | 'info' = 'warn';

  if (!connected) {
    message = '⚠ Connection interrupted — restoring tunnel…';
    tone = 'warn';
  } else if ((phase === 'chat' || phase === 'host-ready') && !peerConnected) {
    message = '⚠ Remote endpoint disconnected';
    tone = 'warn';
  }

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_8%,var(--bg-soft))]"
        >
          <p
            className={`px-4 py-2 text-center font-mono text-[11px] tracking-wide ${
              tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

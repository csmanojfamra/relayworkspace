import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

export function StatusBanner() {
  const { connected, peerConnected, phase, joinRequest } = useSession();

  let message: string | null = null;
  let tone: 'warn' | 'info' = 'warn';

  if (!connected) {
    message = '⚠ Connection interrupted — restoring tunnel…';
    tone = 'warn';
  } else if (joinRequest) {
    message = '> Incoming endpoint awaiting authorization';
    tone = 'info';
  } else if (phase === 'chat' && !peerConnected) {
    // Only after a paired session — not while still waiting for the first join.
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
          className={`overflow-hidden border-b border-[var(--border)] ${
            tone === 'info'
              ? 'bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-soft))]'
              : 'bg-[color-mix(in_srgb,var(--warning)_8%,var(--bg-soft))]'
          }`}
        >
          <p
            className={`px-4 py-2 text-center font-mono text-[11px] tracking-wide ${
              tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--accent)]'
            }`}
          >
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

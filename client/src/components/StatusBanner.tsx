import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

export function StatusBanner() {
  const { connected, peerConnected, phase, joinRequest } = useSession();

  let message: string | null = null;
  let tone: 'warn' | 'info' = 'warn';

  if (!connected) {
    message = 'Connection lost — the note will sync when you’re back online';
    tone = 'warn';
  } else if (joinRequest && phase === 'host-ready') {
    message = 'Join request waiting — allow access to continue';
    tone = 'info';
  } else if (phase === 'chat' && !peerConnected) {
    message = 'Waiting to reconnect — edits will sync when the link is back';
    tone = 'info';
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
              ? 'bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg))]'
              : 'bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg))]'
          }`}
        >
          <p
            className={`px-4 py-2.5 text-center text-[13px] ${
              tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--text)]'
            }`}
          >
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';

export function StatusBanner() {
  const { connected, peerConnected, phase, joinRequest } = useSession();

  let message: string | null = null;
  let tone: 'warn' | 'info' = 'warn';

  if (!connected) {
    message = 'Connection interrupted — restoring your pad…';
    tone = 'warn';
  } else if (joinRequest && phase === 'host-ready') {
    message = 'Someone is requesting access to this pad';
    tone = 'info';
  } else if (phase === 'chat' && !peerConnected) {
    message = 'Remote is offline — notes will sync when they return';
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
              ? 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))]'
              : 'bg-[color-mix(in_srgb,var(--warning)_7%,var(--bg))]'
          }`}
        >
          <p
            className={`px-4 py-2 text-center text-[12px] tracking-wide ${
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

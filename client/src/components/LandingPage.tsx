import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { InceptionShell } from '@/components/InceptionShell';
import { useSession } from '@/hooks/useSession';

export function LandingPage() {
  const { createSession, connected, connectionStatus, reconnect } = useSession();

  const statusText =
    connectionStatus === 'connected'
      ? 'Ready when you are'
      : connectionStatus === 'connecting'
        ? 'Connecting…'
        : 'Can’t reach Relay — check your connection';

  return (
    <InceptionShell>
      <div className="flex h-full flex-col items-center justify-center px-6 pb-10 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[22rem] text-center"
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="notes-glyph mx-auto mb-9"
            aria-hidden
          >
            N
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="text-[46px] font-semibold leading-none tracking-[-0.045em] text-[var(--text)] sm:text-[52px]"
          >
            Relay
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mx-auto mt-4 max-w-[18rem] text-[15px] leading-relaxed text-[var(--text-muted)]"
          >
            Open a note. Share the link. Write in sync — nothing lingers after the session.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.45 }}
            className="mt-11 flex flex-col items-center gap-3"
          >
            <Button
              size="lg"
              className="min-w-[220px] shadow-[0_10px_28px_var(--glow)]"
              onClick={createSession}
              disabled={!connected}
            >
              New note
            </Button>

            {connectionStatus === 'unavailable' && (
              <Button variant="ghost" size="sm" onClick={reconnect}>
                Try again
              </Button>
            )}

            <motion.p
              key={statusText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[13px] ${
                connectionStatus === 'unavailable'
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--text-faint)]'
              }`}
            >
              {statusText}
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </InceptionShell>
  );
}

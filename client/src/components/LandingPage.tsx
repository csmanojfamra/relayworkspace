import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/hooks/useSession';

export function LandingPage() {
  const { createSession, connected } = useSession();

  return (
    <div className="app-shell safe-pad relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[16%] h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--glow)] opacity-80 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--bg)] to-transparent" />
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg text-center"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.45 }}
            className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
          >
            <span className="font-mono text-2xl text-[var(--accent)]">&gt;_</span>
          </motion.div>

          <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--text-faint)]">
            Temporary Secure Workspace
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">
            Relay
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
            Private encrypted sessions.
            <br />
            Nothing stored. Everything temporary.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="min-w-[250px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent),0_14px_44px_var(--glow)]"
              onClick={createSession}
              disabled={!connected}
            >
              Initialize Workspace
            </Button>
            <motion.p
              key={connected ? 'ready' : 'wait'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono text-[11px] text-[var(--text-faint)]"
            >
              {connected ? '> Secure relay available.' : '> Connecting core services...'}
            </motion.p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';

const STEPS = [
  'Initializing workspace...',
  'Loading relay engine...',
  'Generating session keys...',
  'Establishing secure tunnel...',
  'Synchronizing endpoints...',
  'Workspace ready.',
];

export function BootSequence() {
  const { setBootComplete } = useSession();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= STEPS.length - 1) {
      const done = window.setTimeout(() => setBootComplete(), 620);
      return () => window.clearTimeout(done);
    }

    const delay = index === STEPS.length - 2 ? 640 : 480;
    const id = window.setTimeout(() => setIndex((v) => v + 1), delay);
    return () => window.clearTimeout(id);
  }, [index, setBootComplete]);

  return (
    <div className="app-shell safe-pad flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-9"
        >
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-faint)]">
            Relay
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)]">
            Preparing workspace
          </h1>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Establishing a temporary encrypted session.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="glass rounded-2xl p-5"
        >
          <div className="space-y-3.5 font-mono text-[13px]">
            <AnimatePresence mode="popLayout">
              {STEPS.slice(0, index + 1).map((step, i) => {
                const active = i === index;
                const done = i < index || i === STEPS.length - 1;
                return (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3"
                  >
                    <span className={active && !done ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'}>
                      {done && i < STEPS.length - 1 ? '✓' : active ? '>' : '·'}
                    </span>
                    <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>
                      {step}
                    </span>
                    {active && i < STEPS.length - 1 && (
                      <span className="blink ml-1 inline-block h-4 w-[7px] bg-[var(--cursor)]" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-[var(--bg-soft)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              initial={{ width: '0%' }}
              animate={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { InceptionShell } from '@/components/InceptionShell';
import { useSession } from '@/hooks/useSession';

const STEPS = ['Opening the page…', 'Lining the note…', 'Almost ready…'] as const;

export function BootSequence() {
  const { setBootComplete } = useSession();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= STEPS.length - 1) {
      const done = window.setTimeout(() => setBootComplete(), 480);
      return () => window.clearTimeout(done);
    }
    const id = window.setTimeout(() => setIndex((v) => v + 1), 400);
    return () => window.clearTimeout(id);
  }, [index, setBootComplete]);

  return (
    <InceptionShell>
      <div className="flex h-full items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[18rem] text-center"
        >
          <motion.div
            className="notes-glyph notes-glyph-sm mx-auto mb-7"
            aria-hidden
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            N
          </motion.div>
          <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-[var(--text)]">
            Opening note
          </h1>
          <p className="mt-2.5 text-[14px] text-[var(--text-muted)]">{STEPS[index]}</p>

          <div className="mt-9 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              initial={{ width: '0%' }}
              animate={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </motion.div>
      </div>
    </InceptionShell>
  );
}

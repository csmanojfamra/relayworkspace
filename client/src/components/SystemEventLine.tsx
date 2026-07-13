import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { systemPrefix, type SystemEvent, type SystemTone } from '@/lib/terminalEvents';

const toneClass: Record<SystemTone, string> = {
  ok: 'text-[var(--accent)]',
  info: 'text-[var(--me)]',
  warn: 'text-[var(--warning)]',
  idle: 'text-[var(--text-faint)]',
};

interface SystemEventLineProps {
  event: SystemEvent;
  compact?: boolean;
}

export function SystemEventLine({ event, compact = false }: SystemEventLineProps) {
  const lines = [event.text, ...(event.detail ?? [])];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: compact ? 0.34 : 0.68 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-2"
    >
      <div className={`space-y-1 text-[10px] tracking-wide sm:text-[11px] ${toneClass[event.tone]}`}>
        {lines.map((line, i) => (
          <div key={`${event.id}-${i}`} className="flex items-start gap-2">
            <span className="w-[3.25rem] shrink-0 select-none text-right opacity-70">
              {i === 0 ? systemPrefix(event.tone) : ''}
            </span>
            <span className={i === 0 ? undefined : 'opacity-75'}>{line}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** Multi-step secure relay receive — remote entries only. */
export function PreparingOutput() {
  const [phase, setPhase] = useState(0);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 170);
    const t2 = window.setTimeout(() => setPhase(2), 360);

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 340);
      setFill(p);
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const label =
    phase === 0
      ? 'Receiving payload...'
      : phase === 1
        ? 'Integrity verified.'
        : 'Rendering output...';

  const blocks = 10;
  const filled = Math.round(fill * blocks);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-7"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <div className="mt-2.5 space-y-2 text-[12px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <span className="blink inline-block h-3.5 w-[7px] bg-[var(--cursor)]" />
        </div>
        {phase === 0 && (
          <p
            className="select-none font-mono text-[11px] tracking-[0.08em] text-[var(--text-faint)] opacity-70"
            aria-hidden
          >
            {'█'.repeat(filled)}
            {'░'.repeat(Math.max(0, blocks - filled))}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function TypingEvent({ line }: { line: string }) {
  return (
    <motion.div
      key={line}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-7"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <div className="mt-2.5 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span>{line}</span>
        <span className="blink inline-block h-3.5 w-[7px] bg-[var(--cursor)]" />
      </div>
    </motion.div>
  );
}

export function AsciiRule() {
  return (
    <div
      className="select-none overflow-hidden whitespace-nowrap text-[10px] leading-none tracking-[0.18em] text-[var(--text-faint)] opacity-30"
      aria-hidden
    >
      ──────────────────────────────
    </div>
  );
}

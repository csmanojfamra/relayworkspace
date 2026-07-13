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
      animate={{ opacity: compact ? 0.32 : 0.58 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-1"
    >
      <div className={`space-y-0.5 text-[10px] tracking-wide sm:text-[11px] ${toneClass[event.tone]}`}>
        {lines.map((line, i) => (
          <div key={`${event.id}-${i}`} className="flex items-start gap-2">
            <span className="w-[3.25rem] shrink-0 select-none text-right opacity-60">
              {i === 0 ? systemPrefix(event.tone) : ''}
            </span>
            <span className={i === 0 ? undefined : 'opacity-70'}>{line}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** Quiet receive stage — remote entries only. */
export function PreparingOutput() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 140);
    const t2 = window.setTimeout(() => setPhase(2), 280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const label =
    phase === 0
      ? 'Receiving payload...'
      : phase === 1
        ? 'Integrity verified.'
        : 'Rendering output...';

  return (
    <div className="font-mono py-3.5">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <p className="mt-1.5 text-[12px] text-[var(--text-muted)] opacity-80">{label}</p>
    </div>
  );
}

export function TypingEvent({ line }: { line: string }) {
  return (
    <div className="font-mono py-3.5">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <p className="mt-1.5 text-[12px] text-[var(--text-muted)] opacity-80">{line}</p>
    </div>
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

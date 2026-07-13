import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { SystemEvent, SystemTone } from '@/lib/terminalEvents';

const toneClass: Record<SystemTone, string> = {
  ok: 'text-[var(--text-faint)]',
  info: 'text-[var(--text-faint)]',
  warn: 'text-[var(--warning)]',
  idle: 'text-[var(--text-faint)]',
};

interface SystemEventLineProps {
  event: SystemEvent;
  compact?: boolean;
}

/** Quiet pad meta — Apple Notes sidebar energy, not terminal logs. */
export function SystemEventLine({ event, compact = false }: SystemEventLineProps) {
  const lines = [event.text, ...(event.detail ?? [])];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: compact ? 0.4 : 0.55 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="px-1 py-1"
    >
      <div className={`space-y-0.5 font-mono text-[10px] tracking-wide ${toneClass[event.tone]}`}>
        {lines.map((line, i) => (
          <p key={`${event.id}-${i}`} className={i === 0 ? undefined : 'opacity-75'}>
            {line}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

/** Remote note arriving — brief, calm. */
export function PreparingOutput() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 160);
    return () => window.clearTimeout(t1);
  }, []);

  return (
    <div className="note-card note-card-remote px-4 py-3.5 opacity-70 sm:px-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--peer)]">
        Remote
      </p>
      <p className="note-body mt-2 text-[15px] text-[var(--text-muted)]">
        {phase === 0 ? 'Receiving note…' : 'Opening…'}
      </p>
    </div>
  );
}

export function TypingEvent({ line }: { line: string }) {
  return (
    <div className="note-card note-card-remote px-4 py-3.5 opacity-75 sm:px-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--peer)]">
        Remote
      </p>
      <p className="note-body mt-2 text-[15px] text-[var(--text-muted)]">{line || 'Writing…'}</p>
    </div>
  );
}

export function AsciiRule() {
  return (
    <div
      className="select-none overflow-hidden whitespace-nowrap text-[10px] leading-none tracking-[0.18em] text-[var(--text-faint)] opacity-25"
      aria-hidden
    >
      ──────────────────────────────
    </div>
  );
}

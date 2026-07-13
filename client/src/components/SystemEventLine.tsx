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

/** Quiet date-separator style meta — not a terminal log. */
export function SystemEventLine({ event, compact = false }: SystemEventLineProps) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: compact ? 0.45 : 0.65 }}
      className={`py-2 text-center text-[11px] tracking-wide ${toneClass[event.tone]}`}
    >
      {event.text}
    </motion.p>
  );
}

export function PreparingOutput() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 180);
    return () => window.clearTimeout(t1);
  }, []);

  return (
    <div className="note-entry note-entry-remote py-2 opacity-70">
      <p className="text-[11px] font-medium text-[var(--peer)]">Them</p>
      <p className="note-body mt-1 text-[16px] text-[var(--text-muted)]">
        {phase === 0 ? 'Writing…' : 'Adding to the note…'}
      </p>
    </div>
  );
}

export function TypingEvent({ line }: { line: string }) {
  return (
    <div className="note-entry note-entry-remote py-2 opacity-80">
      <p className="text-[11px] font-medium text-[var(--peer)]">Them</p>
      <p className="note-body mt-1 text-[16px] italic text-[var(--text-muted)]">
        {line || 'Writing…'}
      </p>
    </div>
  );
}

export function AsciiRule() {
  return (
    <div
      className="my-2 h-px w-full bg-[color-mix(in_srgb,var(--border)_80%,transparent)]"
      aria-hidden
    />
  );
}

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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: compact ? 0.45 : 0.85 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-2"
    >
      <div className={`flex items-center gap-2.5 text-[11px] tracking-wide ${toneClass[event.tone]}`}>
        <span className="shrink-0 select-none opacity-80">{systemPrefix(event.tone)}</span>
        <span>{event.text}</span>
      </div>
    </motion.div>
  );
}

export function PreparingOutput() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-5"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span>Preparing output...</span>
        <span className="blink inline-block h-3.5 w-[7px] bg-[var(--cursor)]" />
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
      className="font-mono py-5"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span>{line}</span>
        <span className="blink inline-block h-3.5 w-[7px] bg-[var(--cursor)]" />
      </div>
    </motion.div>
  );
}

export function AsciiRule() {
  return (
    <div
      className="select-none overflow-hidden whitespace-nowrap text-[10px] leading-none tracking-[0.18em] text-[var(--text-faint)] opacity-35"
      aria-hidden
    >
      ──────────────────────────────
    </div>
  );
}

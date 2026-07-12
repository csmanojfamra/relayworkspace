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
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: compact ? 0.5 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono"
    >
      <div
        className={`flex items-start gap-2.5 py-2.5 text-[12px] leading-relaxed tracking-wide ${toneClass[event.tone]}`}
      >
        <span className="shrink-0 select-none opacity-90">{systemPrefix(event.tone)}</span>
        <span className={event.tone === 'idle' ? 'text-[var(--text-faint)]' : ''}>
          {event.text}
        </span>
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

export function TypingEvent({ line }: { line: string }) {
  return (
    <motion.div
      key={line}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-3"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: 'var(--peer)' }}
      >
        REMOTE ENDPOINT
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span className="text-[var(--accent)]">&gt;</span>
        <span>Preparing response...</span>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-4 text-[12px] text-[var(--text-faint)]">
        <span>{line}</span>
        <span className="blink inline-block h-3.5 w-[6px] bg-[var(--cursor)]" />
      </div>
    </motion.div>
  );
}

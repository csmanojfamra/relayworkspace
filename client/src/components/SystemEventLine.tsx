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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: compact ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono"
    >
      <AsciiRule />
      <div className={`flex items-start gap-2 py-2 text-[12px] leading-relaxed ${toneClass[event.tone]}`}>
        <span className="shrink-0 select-none opacity-90">{systemPrefix(event.tone)}</span>
        <span className={event.tone === 'idle' ? 'tracking-wide' : ''}>{event.text}</span>
      </div>
      <AsciiRule />
    </motion.div>
  );
}

export function AsciiRule() {
  return (
    <div
      className="select-none overflow-hidden whitespace-nowrap text-[10px] leading-none tracking-[0.12em] text-[var(--text-faint)] opacity-40"
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono"
    >
      <AsciiRule />
      <div className="flex items-center gap-2 py-2 text-[12px] text-[var(--text-muted)]">
        <span className="text-[var(--accent)]">&gt;</span>
        <span>Remote endpoint is preparing a response...</span>
      </div>
      <div className="flex items-center gap-2 pb-2 pl-4 text-[12px] text-[var(--accent)]">
        <span className="opacity-70">{line}</span>
        <span className="blink inline-block h-3.5 w-[6px] bg-[var(--cursor)]" />
      </div>
    </motion.div>
  );
}

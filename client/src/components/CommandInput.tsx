import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { motion } from 'framer-motion';
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery';

interface CommandInputProps {
  onSend: (value: string) => void;
  onTyping: (typing: boolean) => void;
  disabled?: boolean;
}

/** Single-line Warp-style prompt — last line of the terminal stream. */
export function CommandInput({ onSend, onTyping, disabled }: CommandInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  // Phones, tablets, and touch devices — do not rely on Tailwind sm:hidden (640px).
  const showExecute = isMobile || isCoarsePointer;
  const canExecute = Boolean(value.trim()) && !disabled;

  useEffect(() => {
    if (disabled) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [disabled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const emitTyping = (next: boolean) => {
    if (typingRef.current === next) return;
    typingRef.current = next;
    onTyping(next);
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (next.trim()) {
      emitTyping(true);
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      stopTimer.current = window.setTimeout(() => emitTyping(false), 1400);
    } else {
      emitTyping(false);
    }
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    emitTyping(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={false}
      animate={{ opacity: disabled ? 0.4 : 1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="terminal-prompt font-mono pt-7"
      onMouseDown={(e) => {
        if (disabled) return;
        if ((e.target as HTMLElement).closest('textarea, button')) return;
        e.preventDefault();
        textareaRef.current?.focus();
      }}
    >
      <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-2">
        <p className="shrink-0 select-none font-mono text-[12px] leading-7 tracking-tight md:pt-[2px]">
          <span style={{ color: 'var(--me)' }}>relay@local</span>
          <span className="text-[var(--text-faint)]">:~/workspace</span>
          <span className="ml-1.5 text-[var(--accent)]">❯</span>
        </p>

        <div className="flex min-w-0 flex-1 items-end gap-2.5">
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              disabled={disabled}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              enterKeyHint="done"
              aria-label="Terminal prompt"
              className="max-h-[160px] min-h-[36px] w-full resize-none overflow-y-auto bg-transparent p-0 font-mono text-[13px] leading-7 text-[var(--text)] outline-none sm:text-sm"
              style={{
                fontFamily: 'inherit',
                caretColor: value || disabled ? 'var(--cursor)' : 'transparent',
              }}
            />
            {!value && !disabled && (
              <span
                className="blink pointer-events-none absolute left-0 top-[10px] inline-block h-[15px] w-[7px] bg-[var(--cursor)]"
                aria-hidden
              />
            )}
          </div>

          {showExecute && (
            <motion.button
              type="button"
              disabled={!canExecute}
              whileTap={canExecute ? { scale: 0.96 } : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                submit();
              }}
              aria-label="Execute entry"
              title="Execute"
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-mono text-[12px] tracking-wide transition-colors duration-150 ${
                canExecute
                  ? 'border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-soft))] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-faint)]'
              }`}
            >
              <span className="text-[14px] leading-none">↵</span>
              <span>exec</span>
            </motion.button>
          )}
        </div>
      </div>

      {disabled && (
        <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
          Connection offline — prompt locked until tunnel restores
        </p>
      )}
    </motion.form>
  );
}

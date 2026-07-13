import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { motion } from 'framer-motion';

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
        // Keep focus on prompt unless tapping the control itself or the field.
        if ((e.target as HTMLElement).closest('textarea, button')) return;
        e.preventDefault();
        textareaRef.current?.focus();
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
        <p className="shrink-0 select-none font-mono text-[12px] leading-7 tracking-tight sm:pt-[2px]">
          <span style={{ color: 'var(--me)' }}>relay@local</span>
          <span className="text-[var(--text-faint)]">:~/workspace</span>
          <span className="ml-1.5 text-[var(--accent)]">❯</span>
        </p>

        <div className="flex min-w-0 flex-1 items-start gap-2">
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
              className="max-h-[160px] min-h-[28px] w-full resize-none overflow-y-auto bg-transparent p-0 font-mono text-[13px] leading-7 text-[var(--text)] outline-none sm:text-sm"
              style={{
                fontFamily: 'inherit',
                caretColor: value || disabled ? 'var(--cursor)' : 'transparent',
              }}
            />
            {!value && !disabled && (
              <span
                className="blink pointer-events-none absolute left-0 top-[6px] inline-block h-[15px] w-[7px] bg-[var(--cursor)]"
                aria-hidden
              />
            )}
          </div>

          {/*
            Mobile execute control — shell return key, not a chat Send.
            Hidden from sm+ where physical Enter is the natural path.
          */}
          <motion.button
            type="submit"
            disabled={!canExecute}
            whileTap={canExecute ? { scale: 0.94 } : undefined}
            aria-label="Execute entry"
            title="Execute"
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-[13px] leading-none transition-colors duration-150 sm:hidden ${
              canExecute
                ? 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-faint)] opacity-40'
            }`}
          >
            ↵
          </motion.button>
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

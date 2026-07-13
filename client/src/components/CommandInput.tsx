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

/** Live shell prompt — last line of the terminal stream. */
export function CommandInput({ onSend, onTyping, disabled }: CommandInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);

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
    // Keep the same textarea mounted — remounting steals focus from the peer flow
    // and forces extra taps before the next entry can be typed.
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
      className="terminal-prompt font-mono pt-6"
      onMouseDown={(e) => {
        // Focus without waiting for click — avoids lost taps during scroll updates.
        if (disabled) return;
        if ((e.target as HTMLElement).closest('textarea')) return;
        e.preventDefault();
        textareaRef.current?.focus();
      }}
    >
      <p className="select-none font-mono text-[12px] leading-6 tracking-tight text-[var(--text-muted)]">
        <span style={{ color: 'var(--me)' }}>local.endpoint</span>
        <span className="text-[var(--text-faint)]"> ~/workspace</span>
      </p>

      <div className="mt-1.5 flex items-start gap-2.5">
        <span className="select-none font-mono text-[14px] leading-7 text-[var(--accent)]">❯</span>
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
      </div>

      {disabled && (
        <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
          Connection offline — prompt locked until tunnel restores
        </p>
      )}
    </motion.form>
  );
}

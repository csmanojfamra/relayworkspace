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

export function CommandInput({ onSend, onTyping, disabled }: CommandInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [disabled]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
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
    <form
      onSubmit={onSubmit}
      className="command-bar shrink-0 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_94%,transparent)] px-3 pb-[max(10px,var(--safe-bottom))] pt-2.5 backdrop-blur-2xl"
    >
      <motion.div
        animate={{
          borderColor: focused
            ? 'color-mix(in srgb, var(--accent) 35%, var(--border))'
            : 'var(--border)',
          boxShadow: focused
            ? '0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.03)'
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
        transition={{ duration: 0.2 }}
        className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-[var(--bg)] px-3 py-3 ${
          disabled ? 'opacity-55' : ''
        }`}
      >
        <span className="mb-1 select-none text-[var(--accent)]">&gt;</span>
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={disabled ? 'Remote endpoint unavailable' : 'Enter transmission'}
          className="max-h-[148px] min-h-[24px] w-full resize-none bg-transparent text-[13px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] sm:text-sm"
          aria-label="Workspace command input"
        />
        <span
          className={`blink mb-1 inline-block h-5 w-[8px] shrink-0 bg-[var(--cursor)] transition-opacity ${
            value || disabled ? 'opacity-0' : 'opacity-100'
          }`}
          aria-hidden
        />
      </motion.div>
      <p className="mx-auto mt-1.5 max-w-3xl px-1 text-[10px] tracking-wide text-[var(--text-faint)]">
        Enter to transmit · Shift+Enter for newline
      </p>
    </form>
  );
}

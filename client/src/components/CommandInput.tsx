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

/** Keep-style sticky composer — shared pad, not a terminal prompt. */
export function CommandInput({ onSend, onTyping, disabled }: CommandInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const canSave = Boolean(value.trim()) && !disabled;

  useEffect(() => {
    if (disabled || isMobile || isCoarsePointer) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [disabled, isMobile, isCoarsePointer]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, isMobile ? 128 : 168)}px`;
  }, [value, isMobile]);

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
    if (!isMobile) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
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
      animate={{ opacity: disabled ? 0.45 : 1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="note-composer"
      onMouseDown={(e) => {
        if (disabled) return;
        if ((e.target as HTMLElement).closest('textarea, button')) return;
        e.preventDefault();
        textareaRef.current?.focus();
      }}
    >
      <div className="flex items-end gap-2 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck
            autoCapitalize="sentences"
            autoCorrect="on"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Take a note…"
            aria-label="Take a note"
            className="note-body max-h-[168px] min-h-[28px] w-full resize-none overflow-y-auto bg-transparent p-0 text-[16px] leading-7 text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] sm:text-[17px]"
            style={{ caretColor: 'var(--cursor)' }}
          />
        </div>

        <motion.button
          type="button"
          disabled={!canSave}
          whileTap={canSave ? { scale: 0.96 } : undefined}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            submit();
          }}
          aria-label="Save note"
          title="Save note"
          className={`mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9 ${
            canSave
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--text-faint)] opacity-40'
          }`}
        >
          <span className="text-[18px] leading-none">✓</span>
        </motion.button>
      </div>

      {disabled && (
        <p className="border-t border-[var(--border)] px-4 py-2 font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
          Offline — notes unlock when the tunnel restores
        </p>
      )}
    </motion.form>
  );
}

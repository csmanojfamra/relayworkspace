import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery';

interface InlineNoteEditorProps {
  onSend: (value: string) => void;
  onTyping: (typing: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** When caret is at the start of an empty editor, ArrowUp focuses the last line. */
  onArrowUpEmpty?: () => void;
  /** Backspace on empty composer pulls the previous line back for editing. */
  onBackspaceEmpty?: () => void;
  /** Bumps when parent seeds text into the composer (e.g. undo last Enter). */
  seedToken?: number;
  seedText?: string;
}

const LINE = 28;

/** Caret on the ruled page — left-aligned, locked to 28px line grid. */
export function InlineNoteEditor({
  onSend,
  onTyping,
  disabled,
  autoFocus = true,
  onArrowUpEmpty,
  onBackspaceEmpty,
  seedToken = 0,
  seedText = '',
}: InlineNoteEditorProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');

  useEffect(() => {
    if (!autoFocus || disabled || isMobile || isCoarsePointer) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [autoFocus, disabled, isMobile, isCoarsePointer]);

  useEffect(() => {
    if (!seedToken) return;
    setValue(seedText);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = seedText.length;
      el.setSelectionRange(len, len);
    });
  }, [seedToken, seedText]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.max(LINE, Math.min(el.scrollHeight, LINE * 12));
    // Snap height to whole line rows so rules stay aligned.
    el.style.height = `${Math.ceil(next / LINE) * LINE}px`;
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
    if (
      e.key === 'Backspace' &&
      !value &&
      e.currentTarget.selectionStart === 0 &&
      onBackspaceEmpty
    ) {
      e.preventDefault();
      onBackspaceEmpty();
      return;
    }
    if (e.key === 'ArrowUp' && !value && onArrowUpEmpty) {
      e.preventDefault();
      onArrowUpEmpty();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="note-inline-editor"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
    >
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
        enterKeyHint="enter"
        placeholder={disabled ? 'Offline…' : 'Start writing…'}
        aria-label="Write in the note"
        className="note-line block w-full resize-none overflow-hidden bg-transparent text-left text-[var(--text)] outline-none placeholder:text-left placeholder:text-[var(--text-faint)] disabled:opacity-50"
        style={{
          caretColor: 'var(--accent)',
          textAlign: 'left',
          height: LINE,
          minHeight: LINE,
        }}
      />
    </form>
  );
}

export { InlineNoteEditor as CommandInput };

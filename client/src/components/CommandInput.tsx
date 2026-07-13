import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { MAX_ATTACHMENT_BYTES } from '@terminalchat/shared';
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery';

interface InlineNoteEditorProps {
  onSend: (value: string) => void;
  onAttach?: (file: File) => void | Promise<boolean | void>;
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
const ACCEPT = 'image/*,application/pdf,.pdf';

/** Caret on the ruled page — left-aligned, locked to 28px line grid. */
export function InlineNoteEditor({
  onSend,
  onAttach,
  onTyping,
  disabled,
  autoFocus = true,
  onArrowUpEmpty,
  onBackspaceEmpty,
  seedToken = 0,
  seedText = '',
}: InlineNoteEditorProps) {
  const [value, setValue] = useState('');
  const [attachHint, setAttachHint] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const pickFile = () => {
    if (disabled || uploading || !onAttach) return;
    setAttachHint(null);
    fileRef.current?.click();
  };

  const onFileChange = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !onAttach || disabled) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachHint('Keep files under 5 MB.');
      return;
    }

    const mime = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    const okType =
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      name.endsWith('.pdf');
    if (!okType) {
      setAttachHint('Photos and PDFs only.');
      return;
    }

    setUploading(true);
    setAttachHint(null);
    try {
      const ok = await onAttach(file);
      if (ok === false) setAttachHint('Couldn’t add that file. Try another.');
    } catch {
      setAttachHint('Couldn’t add that file. Try another.');
    } finally {
      setUploading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
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
      <div className="flex items-start gap-1.5">
        {onAttach && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => void onFileChange(e.target.files)}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={pickFile}
              aria-label="Add photo or PDF"
              title="Add photo or PDF"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--me)] transition-opacity hover:bg-[color-mix(in_srgb,var(--me)_10%,transparent)] disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M14.5 3.5a3.2 3.2 0 0 1 0 4.5l-5.3 5.3a2.1 2.1 0 1 1-3-3l4.8-4.8.9.9-4.8 4.8a.9.9 0 1 0 1.2 1.2l5.3-5.3a1.9 1.9 0 1 0-2.7-2.7L5.6 10.7a3.2 3.2 0 1 0 4.5 4.5l5.6-5.6.9.9-5.6 5.6a4.5 4.5 0 1 1-6.3-6.3l5.3-5.3a3.2 3.2 0 0 1 4.5 0z" />
              </svg>
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled || uploading}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          spellCheck
          autoCapitalize="sentences"
          autoCorrect="on"
          autoComplete="off"
          enterKeyHint="enter"
          placeholder={
            disabled ? 'Offline…' : uploading ? 'Uploading…' : 'Start writing…'
          }
          aria-label="Write in the note"
          className="note-line block min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-left text-[var(--text)] outline-none placeholder:text-left placeholder:text-[var(--text-faint)] disabled:opacity-50"
          style={{
            caretColor: 'var(--accent)',
            textAlign: 'left',
            height: LINE,
            minHeight: LINE,
          }}
        />
      </div>
      {attachHint && (
        <p className="mt-1 pl-9 text-[12px] text-[var(--warning)]">{attachHint}</p>
      )}
    </form>
  );
}

export { InlineNoteEditor as CommandInput };

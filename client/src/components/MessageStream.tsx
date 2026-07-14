import { AnimatePresence, motion } from 'framer-motion';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { ChatMessage, UserRole } from '@terminalchat/shared';
import { InlineNoteEditor } from '@/components/CommandInput';
import { NoteAttachmentPreview } from '@/components/NoteAttachmentPreview';
import { useSession, type PeerDraft } from '@/hooks/useSession';
import { resolveAttachmentUrl } from '@/lib/utils';

interface MessageStreamProps {
  messages: ChatMessage[];
  role: UserRole | null;
  peerTyping: boolean;
  peerDraft: PeerDraft | null;
  peerConnected: boolean;
  connected: boolean;
  latency: number | null;
  onVisible?: (ids: string[]) => void;
  onSend: (value: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onAttach?: (file: File) => Promise<boolean>;
  onTyping: (typing: boolean) => void;
  onDraft: (content: string, messageId?: string | null) => void;
  inputDisabled?: boolean;
}

/** Must match CSS --note-line (ruled paper rhythm). */
const NOTE_LINE_PX = 28;
const NEAR_BOTTOM_PX = 140;

function noteTitleFromMessages(messages: ChatMessage[]): string {
  const first = messages[0];
  if (!first) return 'Untitled';
  const raw = first.content?.trim() || first.attachment?.name || '';
  if (!raw) return first.attachment ? 'Attachment' : 'Untitled';
  const line = raw.split('\n')[0] ?? raw;
  return line.length > 42 ? `${line.slice(0, 42)}…` : line;
}

function focusComposer() {
  document.querySelector<HTMLTextAreaElement>('.note-inline-editor textarea')?.focus();
}

function focusLine(messageId: string, caret: 'start' | 'end' = 'end') {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-note-id="${messageId}"]`
    );
    if (!el) return;
    el.focus();
    const pos = caret === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  });
}

export function MessageStream({
  messages,
  role,
  peerTyping,
  peerDraft,
  peerConnected: _peerConnected,
  connected: _connected,
  latency: _latency,
  onVisible,
  onSend,
  onEdit,
  onDeleteMessage,
  onAttach,
  onTyping,
  onDraft,
  inputDisabled,
}: MessageStreamProps) {
  const { sessionStartedAt } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const composerSeedRef = useRef<{ token: number; text: string }>({ token: 0, text: '' });
  const [composerSeed, setComposerSeed] = useState(0);

  const title = useMemo(() => noteTitleFromMessages(messages), [messages]);
  const dateLabel = useMemo(() => {
    const ts = messages[0]?.timestamp ?? sessionStartedAt ?? Date.now();
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  }, [messages, sessionStartedAt]);

  const paragraphs = useMemo(
    () =>
      messages.map((message) => ({
        key: message.id,
        message,
        mine: message.senderRole === role,
      })),
    [messages, role]
  );

  const composerPeerDraft =
    peerDraft && !peerDraft.messageId ? peerDraft.content : null;
  // Keep ghost draft visible after they pause — only fall off when a real line lands.
  const lastPeerLine = [...messages].reverse().find((m) => m.senderRole !== role);
  const draftAlreadyCommitted =
    Boolean(composerPeerDraft) &&
    Boolean(lastPeerLine) &&
    lastPeerLine!.content === composerPeerDraft;
  const showPeerComposer = Boolean(composerPeerDraft) && !draftAlreadyCommitted;

  const onScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    stickToBottom.current =
      root.scrollHeight - root.scrollTop - root.clientHeight < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !stickToBottom.current) return;
    root.scrollTop = root.scrollHeight;
  }, [paragraphs.length, composerPeerDraft, peerTyping, messages]);

  useEffect(() => {
    if (!role || !onVisible) return;
    const pending = messages
      .filter((m) => {
        if (role === 'host') return !m.seenByHost;
        if (role === 'guest') return !m.seenByGuest;
        return false;
      })
      .map((m) => m.id);
    if (pending.length) onVisible(pending);
  }, [messages, role, onVisible]);

  const pullLastLineIntoComposer = () => {
    const last = messages[messages.length - 1];
    if (!last || inputDisabled) return;
    if (last.attachment) {
      focusLine(last.id, 'end');
      return;
    }
    composerSeedRef.current = {
      token: composerSeedRef.current.token + 1,
      text: last.content,
    };
    setComposerSeed(composerSeedRef.current.token);
    onDeleteMessage(last.id);
    stickToBottom.current = true;
  };

  return (
    <div className="notes-pad flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-y terminal-scroll min-h-0 flex-1 bg-[var(--note)]"
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest(
              'textarea, a, button, input, [data-note-line], iframe'
            )
          ) {
            return;
          }
          focusComposer();
        }}
      >
        <div className="flex min-h-full w-full flex-col pl-5 pr-4 pb-[max(28px,var(--safe-bottom))] pt-4 sm:pl-6 sm:pr-6">
          <header className="note-page-header shrink-0 text-left">
            <h1 className="note-title w-full text-left text-[28px] font-semibold leading-[1.15] tracking-[-0.035em] text-[var(--text)] sm:text-[32px]">
              {title}
            </h1>
            <p className="mt-1.5 w-full text-left text-[13px] leading-5 text-[var(--text-faint)]">
              {dateLabel}
            </p>
          </header>

          <div className="note-ruled mt-4 min-h-[55vh] w-full flex-1 text-left">
            <AnimatePresence initial={false}>
              {paragraphs.map((item, index) => {
                const prevId = index > 0 ? paragraphs[index - 1]?.key : null;
                const nextId =
                  index < paragraphs.length - 1 ? paragraphs[index + 1]?.key : null;
                const livePeerEdit =
                  peerDraft?.messageId === item.key ? peerDraft.content : null;
                return (
                  <NoteParagraph
                    key={item.key}
                    message={item.message}
                    mine={item.mine}
                    disabled={inputDisabled}
                    livePeerContent={livePeerEdit}
                    onSave={(content) => onEdit(item.key, content)}
                    onDelete={() => {
                      onDeleteMessage(item.key);
                      if (prevId) focusLine(prevId, 'end');
                      else focusComposer();
                    }}
                    onEnter={() => {
                      if (nextId) focusLine(nextId, 'start');
                      else focusComposer();
                    }}
                    onArrowUp={() => {
                      if (prevId) focusLine(prevId, 'end');
                    }}
                    onArrowDown={() => {
                      if (nextId) focusLine(nextId, 'start');
                      else focusComposer();
                    }}
                    onTyping={onTyping}
                    onDraft={(content) => onDraft(content, item.key)}
                  />
                );
              })}
            </AnimatePresence>

            {showPeerComposer && (
              <p className="note-line peer-live-draft whitespace-pre-wrap break-words text-[var(--text)]">
                {composerPeerDraft || ''}
                <span className="peer-live-caret" aria-hidden />
              </p>
            )}

            <InlineNoteEditor
              seedToken={composerSeed}
              seedText={composerSeedRef.current.text}
              onSend={(value) => {
                stickToBottom.current = true;
                onSend(value);
              }}
              onAttach={
                onAttach
                  ? async (file) => {
                      stickToBottom.current = true;
                      return onAttach(file);
                    }
                  : undefined
              }
              onTyping={onTyping}
              onDraft={(content) => onDraft(content, null)}
              disabled={inputDisabled}
              onArrowUpEmpty={() => {
                const last = messages[messages.length - 1];
                if (last) focusLine(last.id, 'end');
              }}
              onBackspaceEmpty={pullLastLineIntoComposer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteParagraph({
  message,
  mine,
  disabled,
  livePeerContent,
  onSave,
  onDelete,
  onEnter,
  onArrowUp,
  onArrowDown,
  onTyping,
  onDraft,
}: {
  message: ChatMessage;
  mine: boolean;
  disabled?: boolean;
  livePeerContent: string | null;
  onSave: (content: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onTyping: (typing: boolean) => void;
  onDraft: (content: string) => void;
}) {
  const [draft, setDraft] = useState(message.content);
  const draftRef = useRef(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const typingRef = useRef(false);
  const stopTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (focusedRef.current) return;
    const next = livePeerContent !== null ? livePeerContent : message.content;
    setDraft(next);
    draftRef.current = next;
  }, [message.content, livePeerContent]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.max(NOTE_LINE_PX, Math.min(el.scrollHeight, NOTE_LINE_PX * 24));
    el.style.height = `${Math.ceil(next / NOTE_LINE_PX) * NOTE_LINE_PX}px`;
  }, [draft]);

  useEffect(() => {
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const emitTyping = (next: boolean) => {
    if (typingRef.current === next) return;
    typingRef.current = next;
    onTyping(next);
  };

  const flushSave = (content: string, { allowDelete = false } = {}) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      if (allowDelete && !message.attachment) onDelete();
      else if (!message.attachment) return;
      else if (message.content.trim()) onSave('');
      return;
    }
    if (trimmed === message.content.trim()) return;
    onSave(trimmed);
  };

  const scheduleSave = (content: string) => {
    if (!content.trim()) {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => flushSave(content), 450);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (e.key === 'Backspace' && atStart && !el.value) {
      e.preventDefault();
      onDraft('');
      onDelete();
      return;
    }

    if (e.key === 'ArrowUp' && atStart) {
      e.preventDefault();
      flushSave(draftRef.current, { allowDelete: !message.attachment });
      onDraft('');
      onArrowUp();
      return;
    }

    if (e.key === 'ArrowDown' && atEnd) {
      e.preventDefault();
      flushSave(draftRef.current, { allowDelete: !message.attachment });
      onDraft('');
      onArrowDown();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      flushSave(draftRef.current, { allowDelete: !message.attachment });
      onDraft('');
      onEnter();
    }
  };

  const attachmentUrl = message.attachment
    ? resolveAttachmentUrl(message.attachment.url)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.12 }}
      data-note-line
      className="note-paragraph-edit"
    >
      {message.attachment && attachmentUrl && (
        <NoteAttachmentPreview
          attachment={message.attachment}
          url={attachmentUrl}
          canRemove={!disabled}
          onRemove={onDelete}
        />
      )}
      <textarea
        ref={textareaRef}
        data-note-id={message.id}
        value={draft}
        disabled={disabled}
        title={mine ? 'You' : 'Them'}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          draftRef.current = next;
          onDraft(next);
          if (next.trim()) {
            emitTyping(true);
            if (stopTimer.current) window.clearTimeout(stopTimer.current);
            stopTimer.current = window.setTimeout(() => emitTyping(false), 1400);
            scheduleSave(next);
          } else {
            emitTyping(false);
            scheduleSave(next);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          focusedRef.current = false;
          emitTyping(false);
          onDraft('');
          flushSave(draftRef.current, { allowDelete: !message.attachment });
        }}
        rows={1}
        spellCheck
        aria-label={message.attachment ? 'Attachment caption' : 'Edit note line'}
        placeholder={message.attachment ? 'Add a caption…' : undefined}
        className="note-line block w-full resize-none overflow-hidden bg-transparent text-left text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] disabled:opacity-50"
        style={{
          caretColor: 'var(--accent)',
          textAlign: 'left',
          minHeight: NOTE_LINE_PX,
        }}
      />
    </motion.div>
  );
}

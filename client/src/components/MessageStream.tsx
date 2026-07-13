import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGE_TTL_MS, type ChatMessage, type UserRole } from '@terminalchat/shared';
import { formatCompactTime, formatUtcTime, shortPromptLabel } from '@/lib/utils';
import { useTerminalTimeline } from '@/hooks/useTerminalTimeline';
import { useCountdown } from '@/hooks/useCountdown';
import { useIsMobile } from '@/hooks/useMediaQuery';
import {
  PreparingOutput,
  SystemEventLine,
  TypingEvent,
} from '@/components/SystemEventLine';
import { CommandInput } from '@/components/CommandInput';

interface MessageStreamProps {
  messages: ChatMessage[];
  role: UserRole | null;
  peerTyping: boolean;
  peerConnected: boolean;
  connected: boolean;
  latency: number | null;
  onVisible?: (ids: string[]) => void;
  onSend: (value: string) => void;
  onTyping: (typing: boolean) => void;
  inputDisabled?: boolean;
}

type StreamItem =
  | {
      kind: 'entry';
      key: string;
      message: ChatMessage;
      mine: boolean;
      staged: boolean;
    }
  | { kind: 'system'; key: string; event: ReturnType<typeof useTerminalTimeline>['events'][number] };

const NEAR_BOTTOM_PX = 96;

export function MessageStream({
  messages,
  role,
  peerTyping,
  peerConnected,
  connected,
  latency,
  onVisible,
  onSend,
  onTyping,
  inputDisabled,
}: MessageStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const stageTimers = useRef(new Map<string, number>());
  const [revealedIds, setRevealedIds] = useState(() => new Set<string>());
  const isMobile = useIsMobile();

  const { events, typingLine, ambient } = useTerminalTimeline({
    peerConnected,
    connected,
    peerTyping,
    messageCount: messages.length,
    latency,
    active: true,
  });

  useEffect(() => {
    for (const message of messages) {
      const mine = message.senderRole === role;
      if (mine) {
        if (!revealedIds.has(message.id)) {
          setRevealedIds((prev) => {
            if (prev.has(message.id)) return prev;
            const next = new Set(prev);
            next.add(message.id);
            return next;
          });
        }
        continue;
      }

      if (revealedIds.has(message.id) || stageTimers.current.has(message.id)) continue;

      const delay = 240 + Math.floor(Math.random() * 200);
      const timer = window.setTimeout(() => {
        stageTimers.current.delete(message.id);
        setRevealedIds((prev) => {
          if (prev.has(message.id)) return prev;
          const next = new Set(prev);
          next.add(message.id);
          return next;
        });
      }, delay);
      stageTimers.current.set(message.id, timer);
    }
  }, [messages, role, revealedIds]);

  useEffect(() => {
    return () => {
      for (const timer of stageTimers.current.values()) window.clearTimeout(timer);
      stageTimers.current.clear();
    };
  }, []);

  const displayItems = useMemo(
    () => buildStream(messages, events, role, revealedIds),
    [messages, events, role, revealedIds]
  );

  const stagingRemote = displayItems.some((i) => i.kind === 'entry' && i.staged);

  const onScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    const distance = root.scrollHeight - root.scrollTop - root.clientHeight;
    stickToBottom.current = distance < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !stickToBottom.current) return;
    root.scrollTop = root.scrollHeight;
  }, [displayItems.length, stagingRemote, revealedIds.size, typingLine]);

  useEffect(() => {
    if (!role || !onVisible) return;
    const pending = messages
      .filter((m) => {
        if (m.senderRole !== role && !revealedIds.has(m.id)) return false;
        if (role === 'host') return !m.seenByHost;
        if (role === 'guest') return !m.seenByGuest;
        return false;
      })
      .map((m) => m.id);
    if (pending.length) onVisible(pending);
  }, [messages, role, onVisible, revealedIds]);

  return (
    <div className="notes-pad flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-y terminal-scroll min-h-0 flex-1 px-3 py-4 sm:px-8 sm:py-6"
      >
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 sm:gap-3.5">
          {displayItems.length === 0 && !typingLine && !(ambient && !isMobile) && (
            <p className="px-1 font-mono text-[11px] tracking-wide text-[var(--text-faint)] opacity-70">
              {peerConnected
                ? 'Shared pad is empty. Take a note.'
                : connected
                  ? 'You can write notes while the remote endpoint is offline.'
                  : 'Waiting for connection…'}
            </p>
          )}

          <AnimatePresence initial={false}>
            {displayItems.map((item) => {
              if (item.kind === 'system') {
                return <SystemEventLine key={item.key} event={item.event} />;
              }
              if (item.staged) {
                return <PreparingOutput key={`prep-${item.key}`} />;
              }
              return (
                <NoteCard
                  key={item.key}
                  message={item.message}
                  mine={item.mine}
                  compact={isMobile}
                />
              );
            })}
          </AnimatePresence>

          {typingLine && !stagingRemote && <TypingEvent line={typingLine} />}

          {!isMobile && ambient && !typingLine && (
            <SystemEventLine key={ambient.id} event={ambient} compact />
          )}

          {peerConnected === false && connected && displayItems.length > 0 && (
            <p className="px-1 py-1 font-mono text-[10px] tracking-wide text-[var(--text-faint)] opacity-50">
              Remote offline — notes sync when they return.
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_96%,transparent)] px-3 py-3 pb-[max(12px,var(--safe-bottom))] backdrop-blur-md sm:px-8">
        <div className="mx-auto w-full max-w-[720px]">
          <CommandInput
            onSend={(value) => {
              stickToBottom.current = true;
              onSend(value);
            }}
            onTyping={onTyping}
            disabled={inputDisabled}
          />
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  message,
  mine,
  compact = false,
}: {
  message: ChatMessage;
  mine: boolean;
  compact?: boolean;
}) {
  const remaining = useCountdown(message.deleteAt);
  const bothSeen = message.seenByHost && message.seenByGuest;
  const author = shortPromptLabel(mine ? 'me' : 'friend');
  const stamp = compact ? formatCompactTime(message.timestamp) : formatUtcTime(message.timestamp);
  const hasTtl = Boolean(message.deleteAt && remaining);

  const ttlProgress =
    hasTtl && message.deleteAt
      ? Math.max(0, Math.min(1, (message.deleteAt - Date.now()) / MESSAGE_TTL_MS))
      : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        marginBottom: 0,
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`note-card ${mine ? 'note-card-local' : 'note-card-remote'} px-4 py-3.5 sm:px-5 sm:py-4`}
    >
      <p
        className={`note-body whitespace-pre-wrap break-words leading-7 text-[var(--text)] ${
          compact ? 'text-[16px]' : 'text-[16px] sm:text-[17px]'
        }`}
      >
        {message.content}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className="font-mono text-[10px] font-medium uppercase tracking-[0.12em]"
          style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
        >
          {author}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--text-faint)] opacity-70">
          {stamp}
        </span>
        {(hasTtl || bothSeen || message.delivered) && (
          <span className="ml-auto flex items-center gap-2 font-mono text-[9px] text-[var(--text-faint)] opacity-45">
            {hasTtl && remaining ? (
              <>
                TTL <span className="tabular-nums">{remaining}</span>
              </>
            ) : bothSeen ? (
              'TTL armed'
            ) : (
              'syncing'
            )}
            {ttlProgress != null && (
              <span
                className="h-px w-8 overflow-hidden bg-[color-mix(in_srgb,var(--border)_80%,transparent)]"
                aria-hidden
              >
                <span
                  className="block h-full origin-left bg-[var(--accent)] opacity-40"
                  style={{ transform: `scaleX(${ttlProgress})` }}
                />
              </span>
            )}
          </span>
        )}
      </div>
    </motion.article>
  );
}

function buildStream(
  messages: ChatMessage[],
  events: ReturnType<typeof useTerminalTimeline>['events'],
  role: UserRole | null,
  revealedIds: Set<string>
): StreamItem[] {
  const merged: Array<
    | { kind: 'entry'; at: number; message: ChatMessage }
    | { kind: 'system'; at: number; event: (typeof events)[number] }
  > = [
    ...events.map((event) => ({ kind: 'system' as const, at: event.timestamp, event })),
    ...messages.map((message) => ({ kind: 'entry' as const, at: message.timestamp, message })),
  ].sort((a, b) => a.at - b.at);

  const items: StreamItem[] = [];

  for (const entry of merged) {
    if (entry.kind === 'system') {
      items.push({ kind: 'system', key: entry.event.id, event: entry.event });
      continue;
    }

    const mine = entry.message.senderRole === role;
    const staged = !mine && !revealedIds.has(entry.message.id);

    items.push({
      kind: 'entry',
      key: entry.message.id,
      message: entry.message,
      mine,
      staged,
    });
  }

  return items;
}

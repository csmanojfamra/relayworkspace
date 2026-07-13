import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGE_TTL_MS, type ChatMessage, type UserRole } from '@terminalchat/shared';
import { formatTime, promptLabel } from '@/lib/utils';
import { useTerminalTimeline } from '@/hooks/useTerminalTimeline';
import { useCountdown } from '@/hooks/useCountdown';
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageTimers = useRef(new Map<string, number>());
  const [revealedIds, setRevealedIds] = useState(() => new Set<string>());

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

      const delay = 320 + Math.floor(Math.random() * 360);
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

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const pin = () => {
      root.scrollTop = root.scrollHeight;
    };

    const active = document.activeElement;
    const typing =
      active instanceof HTMLTextAreaElement && root.contains(active);

    if (typing) {
      pin();
      return;
    }

    const id = window.setTimeout(pin, 16);
    return () => window.clearTimeout(id);
  }, [displayItems.length, typingLine, ambient?.id, stagingRemote, revealedIds.size]);

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
    <div
      ref={scrollRef}
      className="scroll-y terminal-scroll h-full px-6 py-7 font-mono sm:px-12 sm:py-9"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('textarea, button, a, input')) return;
        const prompt = scrollRef.current?.querySelector('textarea');
        if (prompt instanceof HTMLTextAreaElement && !prompt.disabled) {
          e.preventDefault();
          prompt.focus();
        }
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-end pb-[max(18px,var(--safe-bottom))]">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {displayItems.map((item) => {
              if (item.kind === 'system') {
                return <SystemEventLine key={item.key} event={item.event} />;
              }
              if (item.staged) {
                return <PreparingOutput key={`prep-${item.key}`} />;
              }
              return (
                <TerminalEntry
                  key={item.key}
                  message={item.message}
                  mine={item.mine}
                />
              );
            })}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {typingLine && !stagingRemote && (
              <TypingEvent key={typingLine} line={typingLine} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!typingLine && ambient && (
              <SystemEventLine key={ambient.id} event={ambient} compact />
            )}
          </AnimatePresence>

          <div className="pt-3">
            {displayItems.length === 0 && !typingLine && !ambient && (
              <p className="mb-6 font-mono text-[11px] tracking-wide text-[var(--text-faint)]">
                {peerConnected
                  ? 'Awaiting endpoint activity.'
                  : connected
                    ? 'Remote endpoint offline — you can still write entries.'
                    : 'Waiting for connection…'}
              </p>
            )}
            {peerConnected === false && connected && displayItems.length > 0 && (
              <p className="mb-4 font-mono text-[10px] tracking-wide text-[var(--text-faint)] opacity-70">
                Remote offline — new entries sync on reconnect.
              </p>
            )}
            <CommandInput
              onSend={onSend}
              onTyping={onTyping}
              disabled={inputDisabled}
            />
          </div>
        </div>

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}

function TerminalEntry({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  const remaining = useCountdown(message.deleteAt);
  const bothSeen = message.seenByHost && message.seenByGuest;
  const endpoint = promptLabel(mine ? 'me' : 'friend');
  const hasTtl = Boolean(message.deleteAt && remaining);

  const ttlMeta = (() => {
    if (hasTtl && remaining) return remaining;
    if (bothSeen) return 'armed';
    if (message.delivered) return 'synced';
    return 'pending';
  })();

  const ttlProgress =
    hasTtl && message.deleteAt
      ? Math.max(0, Math.min(1, (message.deleteAt - Date.now()) / MESSAGE_TTL_MS))
      : null;

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-6"
    >
      <p
        className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
      >
        {endpoint}
      </p>

      <p className="mt-1.5 font-mono text-[11px] tabular-nums tracking-wide text-[var(--text-faint)] opacity-65">
        {formatTime(message.timestamp)}
      </p>

      <p className="mt-3 whitespace-pre-wrap break-words font-mono text-[14px] leading-7 text-[var(--text)] sm:text-[15px]">
        {message.content}
      </p>

      <div className="mt-3 flex items-center gap-2.5 opacity-55">
        <p className="font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
          {hasTtl ? (
            <>
              Memory TTL{' '}
              <span className="tabular-nums">{ttlMeta}</span>
            </>
          ) : (
            <>Lifetime {ttlMeta}</>
          )}
        </p>
        {ttlProgress != null && (
          <span
            className="h-[1.5px] w-12 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)]"
            aria-hidden
          >
            <span
              className="block h-full origin-left bg-[var(--accent)] opacity-40 transition-[transform] duration-200 ease-linear"
              style={{ transform: `scaleX(${ttlProgress})` }}
            />
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

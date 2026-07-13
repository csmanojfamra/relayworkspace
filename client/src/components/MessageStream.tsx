import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, UserRole } from '@terminalchat/shared';
import { formatEntryId, formatTime, promptLabel } from '@/lib/utils';
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
      entryNo: number;
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
    active: true,
  });

  // Stage remote entries once with timeouts — no 48ms re-render loop (that stole focus).
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

      const delay = 260 + Math.floor(Math.random() * 280);
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

    // Direct scrollTop never steals textarea focus (unlike scrollIntoView on iOS/Safari).
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

    // Slight delay so layout settles after a new entry appears.
    const id = window.setTimeout(pin, 16);
    return () => window.clearTimeout(id);
  }, [displayItems.length, typingLine, ambient?.id, stagingRemote, revealedIds.size]);

  useEffect(() => {
    if (!role || !onVisible) return;
    const pending = messages
      .filter((m) => {
        // Don't mark staged (still preparing) remote entries as seen yet.
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
      className="scroll-y terminal-scroll h-full px-5 py-6 font-mono sm:px-10 sm:py-8"
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
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-end pb-[max(16px,var(--safe-bottom))]">
        <div>
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
                  entryNo={item.entryNo}
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

          <div className="pt-2">
            {displayItems.length === 0 && !typingLine && !ambient && (
              <p className="mb-5 font-mono text-[11px] tracking-wide text-[var(--text-faint)]">
                {peerConnected
                  ? 'Awaiting input.'
                  : connected
                    ? 'Remote endpoint offline — you can still write entries.'
                    : 'Waiting for connection…'}
              </p>
            )}
            {peerConnected === false && connected && displayItems.length > 0 && (
              <p className="mb-3 font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
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
  entryNo,
  mine,
}: {
  message: ChatMessage;
  entryNo: number;
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
      ? Math.max(0, Math.min(1, (message.deleteAt - Date.now()) / 120_000))
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
      className="font-mono py-5"
    >
      <p
        className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
      >
        {endpoint}
      </p>

      <p className="mt-1.5 font-mono text-[11px] tracking-wide text-[var(--text-faint)]">
        <span className="text-[var(--text-muted)]">{formatEntryId(entryNo)}</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span className="tabular-nums">{formatTime(message.timestamp)}</span>
      </p>

      <p className="mt-3 whitespace-pre-wrap break-words font-mono text-[13px] leading-7 text-[var(--text)] sm:text-[14px]">
        {message.content}
      </p>

      <div className="mt-2.5 flex items-center gap-3">
        <p className="font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
          {hasTtl ? (
            <>
              <span className="text-[var(--text-muted)]">Memory TTL</span>{' '}
              <span className="tabular-nums text-[var(--text-muted)]">{ttlMeta}</span>
            </>
          ) : (
            <span className="opacity-70">Lifetime {ttlMeta}</span>
          )}
        </p>
        {ttlProgress != null && (
          <span
            className="h-[2px] w-16 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_80%,transparent)]"
            aria-hidden
          >
            <span
              className="block h-full origin-left bg-[var(--accent)] opacity-50 transition-[transform] duration-200 ease-linear"
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
  let entryNo = 0;

  for (const entry of merged) {
    if (entry.kind === 'system') {
      items.push({ kind: 'system', key: entry.event.id, event: entry.event });
      continue;
    }

    entryNo += 1;
    const mine = entry.message.senderRole === role;
    const staged = !mine && !revealedIds.has(entry.message.id);

    items.push({
      kind: 'entry',
      key: entry.message.id,
      message: entry.message,
      entryNo,
      mine,
      staged,
    });
  }

  return items;
}

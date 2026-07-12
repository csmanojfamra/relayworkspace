import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage, UserRole } from '@terminalchat/shared';
import { formatEntryId, formatTime, promptLabel } from '@/lib/utils';
import { useTerminalTimeline } from '@/hooks/useTerminalTimeline';
import { useCountdown } from '@/hooks/useCountdown';
import { AsciiRule, SystemEventLine, TypingEvent } from '@/components/SystemEventLine';
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
  | { kind: 'entry'; key: string; message: ChatMessage; entryNo: number; mine: boolean }
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
  const { events, typingLine, ambient } = useTerminalTimeline({
    peerConnected,
    connected,
    peerTyping,
    messageCount: messages.length,
    active: true,
  });

  const items = useMemo(
    () => buildStream(messages, events, role),
    [messages, events, role]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items.length, typingLine, ambient?.id]);

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

  return (
    <div
      ref={scrollRef}
      className="scroll-y terminal-scroll h-full px-5 py-5 sm:px-8 sm:py-7"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('textarea, button, a, input')) return;
        const prompt = scrollRef.current?.querySelector('textarea');
        if (prompt instanceof HTMLTextAreaElement && !prompt.disabled) {
          requestAnimationFrame(() => prompt.focus());
        }
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-end pb-[max(16px,var(--safe-bottom))]">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              if (item.kind === 'system') {
                return <SystemEventLine key={item.key} event={item.event} />;
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
            {typingLine && <TypingEvent key={typingLine} line={typingLine} />}
          </AnimatePresence>

          <AnimatePresence>
            {!typingLine && ambient && (
              <SystemEventLine key={ambient.id} event={ambient} compact />
            )}
          </AnimatePresence>

          <div className="pt-2">
            {items.length === 0 && !typingLine && !ambient && (
              <p className="mb-4 font-mono text-[11px] tracking-wide text-[var(--text-faint)]">
                {peerConnected ? 'Awaiting input.' : 'Waiting for remote endpoint.'}
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

  const ttlLabel = (() => {
    if (message.deleteAt && remaining) return `TTL ${remaining}`;
    if (bothSeen) return 'TTL pending';
    if (message.delivered) return 'Transmitted';
    return 'Queued';
  })();

  return (
    <motion.article
      layout={false}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        overflow: 'hidden',
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="font-mono py-4"
    >
      <AsciiRule />

      <div className="pt-3">
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em]"
          style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
        >
          {endpoint}
        </p>
        <p className="mt-1.5 text-[11px] tracking-[0.14em] text-[var(--text-muted)]">
          {formatEntryId(entryNo)}
        </p>
        <p className="mt-1 text-[10px] tabular-nums text-[var(--text-faint)]">
          {formatTime(message.timestamp)}
        </p>
      </div>

      <AsciiRule />

      <div className="mt-3 flex items-start gap-2.5">
        <span className="shrink-0 select-none text-[13px] leading-7 text-[var(--accent)] sm:text-sm">
          &gt;
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-7 text-[var(--text)] sm:text-[14px]">
          {message.content}
        </p>
      </div>

      <p className="mt-2 pl-5 text-[10px] tracking-wide text-[var(--text-faint)] opacity-75">
        {ttlLabel}
      </p>
    </motion.article>
  );
}

function buildStream(
  messages: ChatMessage[],
  events: ReturnType<typeof useTerminalTimeline>['events'],
  role: UserRole | null
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
    items.push({
      kind: 'entry',
      key: entry.message.id,
      message: entry.message,
      entryNo,
      mine: entry.message.senderRole === role,
    });
  }

  return items;
}

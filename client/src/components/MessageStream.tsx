import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, UserRole } from '@terminalchat/shared';
import { formatTime, promptLabel } from '@/lib/utils';
import { useTerminalTimeline } from '@/hooks/useTerminalTimeline';
import { useCountdown } from '@/hooks/useCountdown';
import { useIsMobile } from '@/hooks/useMediaQuery';
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
  | { kind: 'message'; key: string; message: ChatMessage; grouped: boolean }
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
  const isMobile = useIsMobile();
  const { events, typingLine, ambient } = useTerminalTimeline({
    peerConnected,
    connected,
    peerTyping,
    messageCount: messages.length,
    active: true,
  });

  const items = useMemo(() => buildStream(messages, events), [messages, events]);

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
      className="scroll-y terminal-scroll h-full px-4 py-4 sm:px-6 sm:py-6"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('textarea, button, a, input')) return;
        const prompt = scrollRef.current?.querySelector('textarea');
        if (prompt instanceof HTMLTextAreaElement && !prompt.disabled) {
          // Defer so we don't steal selection from interactive children.
          requestAnimationFrame(() => prompt.focus());
        }
      }}
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end pb-[max(12px,var(--safe-bottom))]">
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
                  grouped={item.grouped}
                  mine={item.message.senderRole === role}
                  isMobile={isMobile}
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

          {/* Live prompt — always the last line of the terminal. */}
          <div className="pt-3">
            {items.length === 0 && !typingLine && !ambient && (
              <p className="mb-3 font-mono text-[10px] tracking-wide text-[var(--text-faint)]">
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

        <div ref={bottomRef} className="h-3" />
      </div>
    </div>
  );
}

function TerminalEntry({
  message,
  grouped,
  mine,
  isMobile,
}: {
  message: ChatMessage;
  grouped: boolean;
  mine: boolean;
  isMobile: boolean;
}) {
  const [showMeta, setShowMeta] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const remaining = useCountdown(message.deleteAt);
  const bothSeen = message.seenByHost && message.seenByGuest;

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  const statusLabel = (() => {
    if (message.deleteAt && remaining) {
      return `✓ Acknowledged · Purges in ${remaining}`;
    }
    if (bothSeen) return '✓ Acknowledged';
    if (mine) {
      const remoteSeen =
        message.senderRole === 'host' ? message.seenByGuest : message.seenByHost;
      if (remoteSeen) return '✓ Acknowledged';
      return message.delivered ? 'Written' : 'Pending';
    }
    return message.delivered ? 'Written' : 'Pending';
  })();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: -4,
        height: 0,
        paddingTop: 0,
        marginTop: 0,
        overflow: 'hidden',
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="group font-mono"
      style={{ paddingTop: grouped ? 4 : 12 }}
      onMouseEnter={() => {
        if (!isMobile) setShowMeta(true);
      }}
      onMouseLeave={() => {
        if (!isMobile) setShowMeta(false);
      }}
      onPointerDown={() => {
        if (!isMobile) return;
        longPressTimer.current = window.setTimeout(() => setShowMeta(true), 420);
      }}
      onPointerUp={() => {
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      }}
      onPointerCancel={() => {
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      }}
      onClick={() => {
        if (isMobile && showMeta) setShowMeta(false);
      }}
    >
      {!grouped && (
        <>
          <AsciiRule />
          <p
            className="pt-2.5 text-[12px] font-medium tracking-tight"
            style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
          >
            {promptLabel(mine ? 'me' : 'friend')}
          </p>
        </>
      )}

      <div className={`flex items-start gap-2 ${grouped ? '' : 'mt-1.5'}`}>
        <span className="shrink-0 select-none text-[13px] leading-7 text-[var(--accent)] sm:text-sm">
          &gt;
        </span>
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-7 text-[var(--text)] sm:text-sm">
          {message.content}
        </p>
      </div>

      <p className="mt-1 pl-5 text-[10px] tabular-nums text-[var(--text-faint)] opacity-70">
        {formatTime(message.timestamp)}
      </p>

      <AnimatePresence>
        {showMeta && (
          <motion.p
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1 pl-5 text-[10px] tracking-wide text-[var(--text-faint)]"
          >
            {statusLabel}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function buildStream(
  messages: ChatMessage[],
  events: ReturnType<typeof useTerminalTimeline>['events']
): StreamItem[] {
  const merged: Array<
    | { kind: 'message'; at: number; message: ChatMessage }
    | { kind: 'system'; at: number; event: (typeof events)[number] }
  > = [
    ...events.map((event) => ({ kind: 'system' as const, at: event.timestamp, event })),
    ...messages.map((message) => ({ kind: 'message' as const, at: message.timestamp, message })),
  ].sort((a, b) => a.at - b.at);

  const items: StreamItem[] = [];
  let lastRole: UserRole | null = null;
  let lastAt = 0;

  for (const entry of merged) {
    if (entry.kind === 'system') {
      items.push({ kind: 'system', key: entry.event.id, event: entry.event });
      lastRole = null;
      continue;
    }

    const grouped =
      lastRole === entry.message.senderRole && entry.message.timestamp - lastAt < 90_000;

    items.push({
      kind: 'message',
      key: entry.message.id,
      message: entry.message,
      grouped,
    });
    lastRole = entry.message.senderRole;
    lastAt = entry.message.timestamp;
  }

  return items;
}

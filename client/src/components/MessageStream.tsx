import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, UserRole } from '@terminalchat/shared';
import { formatTime, promptLabel } from '@/lib/utils';
import { useTerminalTimeline } from '@/hooks/useTerminalTimeline';
import { useCountdown } from '@/hooks/useCountdown';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { AsciiRule, SystemEventLine, TypingEvent } from '@/components/SystemEventLine';

interface MessageStreamProps {
  messages: ChatMessage[];
  role: UserRole | null;
  peerTyping: boolean;
  peerConnected: boolean;
  connected: boolean;
  onVisible?: (ids: string[]) => void;
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
}: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
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

  const empty = items.length === 0 && !typingLine && !ambient;

  return (
    <div className="scroll-y terminal-scroll h-full px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end">
        {empty && (
          <div className="mb-auto flex flex-1 flex-col items-center justify-center gap-3 py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
              Secure Workspace
            </p>
            <p className="max-w-xs text-center text-xs leading-relaxed text-[var(--text-muted)]">
              {peerConnected
                ? 'Secure tunnel ready. Transmissions will appear here.'
                : 'Waiting for remote endpoint to connect.'}
            </p>
            <span className="blink mt-2 inline-block h-4 w-[7px] bg-[var(--cursor)] opacity-70" />
          </div>
        )}

        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              if (item.kind === 'system') {
                return <SystemEventLine key={item.key} event={item.event} />;
              }

              return (
                <EphemeralMessage
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
        </div>

        <div ref={bottomRef} className="h-5" />
      </div>
    </div>
  );
}

function EphemeralMessage({
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
      return message.delivered ? 'Transmitted' : 'Queued';
    }
    return message.delivered ? 'Transmitted' : 'Queued';
  })();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
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
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
      {!grouped && <AsciiRule />}
      <div className={`flex items-baseline justify-between gap-3 ${grouped ? '' : 'pt-2.5'}`}>
        {!grouped ? (
          <p
            className="text-[12px] font-medium tracking-tight"
            style={{ color: mine ? 'var(--me)' : 'var(--peer)' }}
          >
            {promptLabel(mine ? 'me' : 'friend')}
          </p>
        ) : (
          <span className="select-none text-[12px] text-transparent">·</span>
        )}
        <p className="shrink-0 text-[10px] tabular-nums text-[var(--text-faint)]">
          {formatTime(message.timestamp)}
        </p>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-7 text-[var(--text)] sm:text-sm">
        {message.content}
      </p>

      <AnimatePresence>
        {showMeta && (
          <motion.p
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 text-[10px] tracking-wide text-[var(--text-faint)]"
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

import { useEffect, useRef, useState } from 'react';
import {
  IDLE_LINES,
  TYPING_LINES,
  type SystemEvent,
  type SystemTone,
} from '@/lib/terminalEvents';

function makeEvent(tone: SystemTone, text: string): SystemEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    text,
    timestamp: Date.now(),
  };
}

interface TimelineOptions {
  peerConnected: boolean;
  connected: boolean;
  peerTyping: boolean;
  messageCount: number;
  active: boolean;
}

export function useTerminalTimeline({
  peerConnected,
  connected,
  peerTyping,
  messageCount,
  active,
}: TimelineOptions) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [typingLine, setTypingLine] = useState<string | null>(null);
  const [ambient, setAmbient] = useState<SystemEvent | null>(null);

  const prevPeer = useRef<boolean | null>(null);
  const prevConnected = useRef<boolean | null>(null);
  const typingIndex = useRef(0);
  const lastActivity = useRef(Date.now());
  const announcedChannel = useRef(false);

  const push = (tone: SystemTone, text: string) => {
    setEvents((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.text === text && Date.now() - last.timestamp < 1500) return prev;
      return [...prev.slice(-40), makeEvent(tone, text)];
    });
    lastActivity.current = Date.now();
    setAmbient(null);
  };

  useEffect(() => {
    if (!active) return;

    if (prevPeer.current === null) {
      prevPeer.current = peerConnected;
      if (peerConnected && !announcedChannel.current) {
        announcedChannel.current = true;
        push('ok', 'Secure tunnel established');
        push('info', 'Endpoint connected');
        push('ok', 'Session encrypted');
        push('ok', 'Relay initialized');
      }
      return;
    }

    if (peerConnected && !prevPeer.current) {
      announcedChannel.current = true;
      push('info', 'Endpoint connected');
      push('ok', 'Secure tunnel established');
      push('ok', 'Session encrypted');
    } else if (!peerConnected && prevPeer.current) {
      push('warn', 'Remote endpoint disconnected');
    }

    prevPeer.current = peerConnected;
  }, [peerConnected, active]);

  useEffect(() => {
    if (!active) return;

    if (prevConnected.current === null) {
      prevConnected.current = connected;
      return;
    }

    if (!connected && prevConnected.current) {
      push('warn', 'Connection interrupted');
    } else if (connected && !prevConnected.current) {
      push('ok', 'Synchronization complete');
      if (peerConnected) push('ok', 'Secure tunnel established');
    }

    prevConnected.current = connected;
  }, [connected, peerConnected, active]);

  useEffect(() => {
    lastActivity.current = Date.now();
    setAmbient(null);
  }, [messageCount, peerTyping]);

  useEffect(() => {
    if (!peerTyping) {
      setTypingLine(null);
      typingIndex.current = 0;
      return;
    }

    setTypingLine(TYPING_LINES[0]);
    const id = window.setInterval(() => {
      typingIndex.current = (typingIndex.current + 1) % TYPING_LINES.length;
      setTypingLine(TYPING_LINES[typingIndex.current]);
    }, 2000);

    return () => window.clearInterval(id);
  }, [peerTyping]);

  useEffect(() => {
    if (!active || !peerConnected || peerTyping) {
      setAmbient(null);
      return;
    }

    const tick = () => {
      const quietFor = Date.now() - lastActivity.current;
      if (quietFor < 45000) {
        setAmbient(null);
        return;
      }
      const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
      setAmbient(makeEvent('idle', line));
    };

    const id = window.setInterval(tick, 60000 + Math.floor(Math.random() * 30000));
    const first = window.setTimeout(tick, 45000 + Math.floor(Math.random() * 45000));
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [active, peerConnected, peerTyping, messageCount]);

  return { events, typingLine, ambient };
}

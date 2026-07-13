import { useEffect, useRef, useState } from 'react';
import type { SystemEvent } from '@/lib/terminalEvents';
import { TYPING_LINES } from '@/lib/terminalEvents';
import { WorkspaceTelemetry } from '@/lib/workspaceTelemetry';

interface TimelineOptions {
  peerConnected: boolean;
  connected: boolean;
  peerTyping: boolean;
  messageCount: number;
  latency: number | null;
  active: boolean;
}

export function useTerminalTimeline({
  peerConnected,
  connected,
  peerTyping,
  messageCount,
  latency,
  active,
}: TimelineOptions) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [typingLine, setTypingLine] = useState<string | null>(null);
  const [ambient, setAmbient] = useState<SystemEvent | null>(null);

  const telemetry = useRef(new WorkspaceTelemetry());
  const prevPeer = useRef<boolean | null>(null);
  const prevConnected = useRef<boolean | null>(null);
  const prevCount = useRef(messageCount);
  const typingIndex = useRef(0);
  const lastActivity = useRef(Date.now());
  const announcedChannel = useRef(false);
  const memoryTick = useRef(0);

  const pushMany = (next: SystemEvent | SystemEvent[]) => {
    const list = Array.isArray(next) ? next : [next];
    if (!list.length) return;
    setEvents((prev) => {
      let out = prev;
      for (const event of list) {
        const last = out[out.length - 1];
        if (last && last.text === event.text && Date.now() - last.timestamp < 1600) continue;
        out = [...out.slice(-48), event];
      }
      return out;
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
        pushMany(telemetry.current.onSessionCreated());
      }
      return;
    }

    if (peerConnected && !prevPeer.current) {
      announcedChannel.current = true;
      pushMany(telemetry.current.onRemoteConnected());
    } else if (!peerConnected && prevPeer.current) {
      pushMany(telemetry.current.onRemoteDisconnected());
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
      pushMany(telemetry.current.onConnectionLost());
    } else if (connected && !prevConnected.current) {
      pushMany(telemetry.current.onReconnect(peerConnected));
    }

    prevConnected.current = connected;
  }, [connected, peerConnected, active]);

  useEffect(() => {
    lastActivity.current = Date.now();
    setAmbient(null);

    if (messageCount < prevCount.current) {
      const purged = telemetry.current.onMessageExpired();
      if (purged) pushMany(purged);
    }
    prevCount.current = messageCount;
  }, [messageCount, peerTyping]);

  useEffect(() => {
    if (!active || !connected) return;
    const event = telemetry.current.onLatencyChange(latency);
    if (event) pushMany(event);
  }, [latency, active, connected]);

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
    }, 900);

    return () => window.clearInterval(id);
  }, [peerTyping]);

  useEffect(() => {
    if (!active || !peerConnected || peerTyping) {
      setAmbient(null);
      return;
    }

    const tick = () => {
      const quietFor = Date.now() - lastActivity.current;
      const idle = telemetry.current.onIdle(quietFor);
      if (!idle) {
        setAmbient(null);
        return;
      }
      memoryTick.current += 1;
      if (memoryTick.current % 4 === 0) {
        setAmbient(telemetry.current.onMemoryCleanup());
        return;
      }
      setAmbient(idle);
    };

    const id = window.setInterval(tick, 55_000 + Math.floor(Math.random() * 35_000));
    const first = window.setTimeout(tick, 48_000 + Math.floor(Math.random() * 40_000));
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [active, peerConnected, peerTyping, messageCount]);

  return { events, typingLine, ambient };
}

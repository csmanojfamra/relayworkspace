import { useEffect, useRef, useState } from 'react';
import type { SystemEvent } from '@/lib/terminalEvents';
import { TYPING_LINES } from '@/lib/terminalEvents';
import { WorkspaceTelemetryEngine } from '@/lib/workspaceTelemetry';

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

  const telemetry = useRef(new WorkspaceTelemetryEngine());
  const prevPeer = useRef<boolean | null>(null);
  const prevConnected = useRef<boolean | null>(null);
  const prevCount = useRef(messageCount);
  const typingIndex = useRef(0);
  const lastActivity = useRef(Date.now());
  const announcedChannel = useRef(false);
  const memoryTick = useRef(0);

  const pushMany = (next: SystemEvent | SystemEvent[] | null) => {
    if (!next) return;
    const list = Array.isArray(next) ? next : [next];
    if (!list.length) return;
    setEvents((prev) => {
      let out = prev;
      for (const event of list) {
        const last = out[out.length - 1];
        if (last && last.text === event.text && Date.now() - last.timestamp < 1800) continue;
        out = [...out.slice(-56), event];
      }
      return out;
    });
    lastActivity.current = Date.now();
    setAmbient(null);
  };

  useEffect(() => {
    if (!active || !connected) return;
    if (announcedChannel.current) return;
    announcedChannel.current = true;
    pushMany(telemetry.current.onSessionStarted());
  }, [active, connected]);

  useEffect(() => {
    if (!active) return;

    if (prevPeer.current === null) {
      prevPeer.current = peerConnected;
      if (peerConnected) {
        pushMany(telemetry.current.onRemoteConnected());
      }
      return;
    }

    if (peerConnected && !prevPeer.current) {
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
      pushMany(telemetry.current.onMessageExpired());
    }
    prevCount.current = messageCount;
  }, [messageCount, peerTyping]);

  useEffect(() => {
    if (!active || !connected) return;
    pushMany(telemetry.current.onLatencySpike(latency));
  }, [latency, active, connected]);

  useEffect(() => {
    if (!peerTyping) {
      setTypingLine(null);
      typingIndex.current = 0;
      return;
    }

    // Stable line only — rotating copy felt like blinking noise.
    setTypingLine(TYPING_LINES[0]);
  }, [peerTyping]);

  useEffect(() => {
    if (!active || !connected || peerTyping) {
      setAmbient(null);
      return;
    }

    const scheduleNext = (fn: () => void) =>
      window.setTimeout(fn, 90_000 + Math.floor(Math.random() * 90_000));

    let timer = 0;

    const tick = () => {
      const quietFor = Date.now() - lastActivity.current;
      memoryTick.current += 1;

      if (memoryTick.current % 5 === 0 && quietFor > 70_000) {
        setAmbient(telemetry.current.onMemoryCleanup());
      } else {
        const idle = telemetry.current.onIdle(quietFor);
        setAmbient(idle);
      }

      timer = scheduleNext(tick);
    };

    timer = scheduleNext(tick);
    return () => window.clearTimeout(timer);
  }, [active, connected, peerTyping, peerConnected, messageCount]);

  return { events, typingLine, ambient };
}

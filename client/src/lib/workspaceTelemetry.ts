import {
  IDLE_LINES,
  PREPARE_LINES,
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

/**
 * Contextual workspace telemetry — believable OS-style events, not chat chrome.
 * Call sites remain UI-only; nothing here talks to the network.
 */
export class WorkspaceTelemetry {
  private lastLatencyBucket: string | null = null;
  private lastPurgeAt = 0;

  onSessionCreated(): SystemEvent[] {
    return [
      makeEvent('ok', 'Secure tunnel established'),
      makeEvent('ok', 'Encryption verified'),
      makeEvent('ok', 'Relay available'),
    ];
  }

  onRemoteConnected(): SystemEvent[] {
    return [
      makeEvent('info', 'Endpoint connected'),
      makeEvent('ok', 'Workspace synchronized'),
    ];
  }

  onRemoteDisconnected(): SystemEvent {
    return makeEvent('warn', 'Remote endpoint offline — session held');
  }

  onReconnect(peerConnected: boolean): SystemEvent[] {
    const events = [
      makeEvent('ok', 'Workspace synchronized'),
      makeEvent('ok', 'Relay synchronized'),
    ];
    if (peerConnected) events.push(makeEvent('ok', 'Session integrity verified'));
    return events;
  }

  onConnectionLost(): SystemEvent {
    return makeEvent('warn', 'Connection interrupted');
  }

  onIdle(quietMs: number): SystemEvent | null {
    if (quietMs < 50_000) return null;
    if (quietMs > 180_000) {
      return makeEvent('idle', 'Awaiting endpoint activity');
    }
    const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    return makeEvent('idle', line);
  }

  onLatencyChange(latency: number | null): SystemEvent | null {
    if (latency == null) return null;
    const bucket = latency < 80 ? 'optimal' : latency < 160 ? 'normal' : 'elevated';
    if (bucket === this.lastLatencyBucket) return null;
    this.lastLatencyBucket = bucket;
    return makeEvent('idle', 'Latency recalibrated');
  }

  onMessageReceived(): SystemEvent | null {
    // Remote entries stage in the stream; no extra log needed.
    return null;
  }

  onMessageExpired(): SystemEvent | null {
    const now = Date.now();
    if (now - this.lastPurgeAt < 4000) return null;
    this.lastPurgeAt = now;
    return makeEvent('idle', 'Expired entries purged');
  }

  onRemoteTyping(): string {
    return this.prepareLine(0);
  }

  onMemoryCleanup(): SystemEvent {
    return makeEvent('idle', 'Memory optimized');
  }

  prepareLine(index: number): string {
    return PREPARE_LINES[index % PREPARE_LINES.length];
  }
}

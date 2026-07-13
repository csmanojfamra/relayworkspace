import type { SystemEvent, SystemTone } from '@/lib/terminalEvents';

function makeEvent(
  tone: SystemTone,
  text: string,
  detail?: string[]
): SystemEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    text,
    detail,
    timestamp: Date.now(),
  };
}

/** ~50 operational lines — picked by context, never spam-repeated. */
const POOL = {
  session: [
    'Secure tunnel established',
    'Encryption verified',
    'Relay available',
    'Session keys verified',
    'Workspace channel open',
    'Endpoint handshake complete',
  ],
  remoteJoin: [
    'Endpoint connected',
    'Workspace synchronized',
    'Remote endpoint authenticated',
    'Shared memory aligned',
    'Relay path confirmed',
    'Peer channel ready',
  ],
  remoteLeave: [
    'Remote endpoint unavailable',
    'Workspace preserved',
    'Automatic synchronization enabled',
    'Session held pending restore',
  ],
  reconnect: [
    'Remote endpoint restored',
    'Workspace synchronized',
    'Relay synchronized',
    'Session integrity verified',
    'Channel renegotiated',
    'Endpoint state reconciled',
  ],
  connectionLost: [
    'Connection interrupted',
    'Tunnel suspended',
    'Awaiting network restore',
  ],
  idle: [
    'Heartbeat OK',
    'Workspace idle',
    'Listening...',
    'Relay healthy',
    'Memory stable',
    'Connection stable',
    'Workspace verified',
    'Relay available',
    'Session integrity verified',
    'Background cleanup completed',
    'Memory compacted',
    'Relay synchronized',
    'Encryption verified',
    'Workspace synchronized',
    'Awaiting endpoint activity',
    'Idle watchdog armed',
    'Endpoint poll quiet',
    'Tunnel keep-alive acknowledged',
    'Shared buffer stable',
    'No pending relay traffic',
  ],
  longIdle: [
    'Awaiting endpoint activity',
    'Workspace idle',
    'Listening...',
    'No endpoint activity detected',
  ],
  latency: [
    'Latency recalibrated',
    'RTT sample updated',
    'Path metrics refreshed',
    'Relay timing adjusted',
  ],
  purge: [
    'Expired entries purged',
    'Memory reclaimed',
    'Stale buffers cleared',
    'TTL sweep completed',
  ],
  memory: [
    'Memory optimized',
    'Memory compacted',
    'Background cleanup completed',
    'Buffer pressure normalized',
    'Workspace heap trimmed',
  ],
  receive: [
    'Payload received',
    'Integrity verified',
    'Rendering output',
  ],
} as const;

/**
 * Contextual workspace telemetry — believable OS events, not decorative chatter.
 * UI-only; never talks to the network.
 */
export class WorkspaceTelemetryEngine {
  private recent: string[] = [];
  private lastLatencyBucket: string | null = null;
  private lastPurgeAt = 0;
  private lastIdleAt = 0;

  private pick(pool: readonly string[]): string {
    const available = pool.filter((line) => !this.recent.includes(line));
    const source = available.length ? available : [...pool];
    const line = source[Math.floor(Math.random() * source.length)]!;
    this.recent = [...this.recent.slice(-10), line];
    return line;
  }

  private pickMany(pool: readonly string[], count: number): string[] {
    const chosen: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const available = pool.filter((line) => !used.has(line) && !this.recent.includes(line));
      const source = available.length
        ? available
        : pool.filter((line) => !used.has(line));
      if (!source.length) break;
      const line = source[Math.floor(Math.random() * source.length)]!;
      used.add(line);
      chosen.push(line);
      this.recent = [...this.recent.slice(-10), line];
    }
    return chosen;
  }

  onSessionStarted(): SystemEvent[] {
    const lines = this.pickMany(POOL.session, 3);
    return lines.map((text, i) => makeEvent(i === 0 ? 'ok' : 'ok', text));
  }

  /** @deprecated alias */
  onSessionCreated(): SystemEvent[] {
    return this.onSessionStarted();
  }

  onRemoteConnected(): SystemEvent[] {
    const [primary, ...rest] = this.pickMany(POOL.remoteJoin, 2);
    return [
      makeEvent('info', primary ?? 'Endpoint connected'),
      ...rest.map((text) => makeEvent('ok', text)),
    ];
  }

  onRemoteDisconnected(): SystemEvent[] {
    const lines = this.pickMany(POOL.remoteLeave, 3);
    const [head, ...detail] = lines;
    return [
      makeEvent('warn', head ?? 'Remote endpoint unavailable', detail),
    ];
  }

  onReconnect(peerConnected: boolean): SystemEvent[] {
    if (peerConnected) {
      const lines = this.pickMany(POOL.reconnect, 3);
      const [head, ...detail] = lines;
      return [makeEvent('info', head ?? 'Remote endpoint restored', detail)];
    }
    return this.pickMany(POOL.reconnect, 2).map((text) => makeEvent('ok', text));
  }

  onConnectionLost(): SystemEvent[] {
    const lines = this.pickMany(POOL.connectionLost, 2);
    const [head, ...detail] = lines;
    return [makeEvent('warn', head ?? 'Connection interrupted', detail)];
  }

  onIdle(quietMs: number): SystemEvent | null {
    const now = Date.now();
    if (quietMs < 55_000) return null;
    if (now - this.lastIdleAt < 50_000) return null;
    this.lastIdleAt = now;

    if (quietMs > 150_000) {
      return makeEvent('idle', this.pick(POOL.longIdle));
    }
    return makeEvent('idle', this.pick(POOL.idle));
  }

  onLatencySpike(latency: number | null): SystemEvent | null {
    if (latency == null) return null;
    const bucket =
      latency < 80 ? 'optimal' : latency < 160 ? 'normal' : latency < 260 ? 'elevated' : 'spike';
    if (bucket === this.lastLatencyBucket) return null;
    const prev = this.lastLatencyBucket;
    this.lastLatencyBucket = bucket;
    if (prev == null) return null;
    if (bucket === 'spike' || (prev === 'optimal' && bucket !== 'optimal')) {
      return makeEvent('idle', this.pick(POOL.latency));
    }
    if (bucket === 'optimal' && prev !== 'optimal') {
      return makeEvent('idle', this.pick(POOL.latency));
    }
    return null;
  }

  onLatencyChange(latency: number | null): SystemEvent | null {
    return this.onLatencySpike(latency);
  }

  onMessageReceived(): SystemEvent | null {
    return null;
  }

  onMessageExpired(): SystemEvent | null {
    const now = Date.now();
    if (now - this.lastPurgeAt < 3500) return null;
    this.lastPurgeAt = now;
    return makeEvent('idle', this.pick(POOL.purge));
  }

  onMemoryCleanup(): SystemEvent {
    return makeEvent('idle', this.pick(POOL.memory));
  }

  onWorkspaceClosed(): SystemEvent {
    return makeEvent('warn', 'Workspace closed');
  }

  onRemoteTyping(): string {
    return 'Receiving payload...';
  }
}

/** Back-compat alias */
export { WorkspaceTelemetryEngine as WorkspaceTelemetry };

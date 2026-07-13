export type SystemTone = 'ok' | 'info' | 'warn' | 'idle';

export interface SystemEvent {
  id: string;
  tone: SystemTone;
  text: string;
  detail?: string[];
  timestamp: number;
}

export const PREPARE_LINES = [
  'Receiving payload...',
  'Integrity verified.',
  'Rendering output...',
] as const;

export const TYPING_LINES = [
  'Receiving payload...',
  'Synchronizing stream...',
  'Awaiting commit...',
] as const;

export const IDLE_LINES = [
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
] as const;

export function systemPrefix(tone: SystemTone): string {
  switch (tone) {
    case 'ok':
      return '[OK]';
    case 'warn':
      return '[WARN]';
    case 'idle':
      return '·';
    default:
      return '[INFO]';
  }
}

export function syncStatus(
  latency: number | null,
  connected: boolean,
  peerConnected: boolean
): string {
  if (!connected) return 'Interrupted';
  if (!peerConnected) return 'Standby';
  if (latency == null) return 'Syncing';
  if (latency < 120) return 'Healthy';
  if (latency < 220) return 'Stable';
  return 'Degraded';
}

export function sessionStatus(connected: boolean, peerConnected: boolean): string {
  if (!connected) return 'Reconnecting';
  if (!peerConnected) return 'Standby';
  return 'Encrypted';
}

export function connectionHealth(
  latency: number | null,
  connected: boolean,
  peerConnected: boolean
): string {
  return syncStatus(latency, connected, peerConnected);
}

/** @deprecated Prefer syncStatus — kept for sidebar compatibility */
export function packetStatus(latency: number | null, connected: boolean): string {
  return syncStatus(latency, connected, true);
}

/** @deprecated Prefer live MB display in Header */
export function memoryStatus(latency: number | null, connected: boolean): string {
  if (!connected) return 'Paused';
  if (latency == null) return 'Warming';
  if (latency < 200) return 'Normal';
  return 'Elevated';
}

export type SystemTone = 'ok' | 'info' | 'warn' | 'idle';

export interface SystemEvent {
  id: string;
  tone: SystemTone;
  text: string;
  timestamp: number;
}

export const PREPARE_LINES = [
  'Preparing output...',
  'Synchronizing...',
  'Rendering...',
] as const;

export const TYPING_LINES = [
  'Preparing output...',
  'Synchronizing...',
  'Rendering...',
] as const;

export const IDLE_LINES = [
  'Heartbeat OK',
  'Workspace synchronized',
  'Memory optimized',
  'Relay synchronized',
  'Connection stable',
  'Encryption verified',
  'Workspace verified',
  'Relay available',
  'Memory compacted',
  'Background cleanup completed',
  'Session integrity verified',
] as const;

export function systemPrefix(tone: SystemTone): string {
  switch (tone) {
    case 'ok':
      return '✓';
    case 'warn':
      return '⚠';
    case 'idle':
      return '·';
    default:
      return '›';
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
  return 'Active';
}

export function memoryStatus(latency: number | null, connected: boolean): string {
  if (!connected) return 'Paused';
  if (latency == null) return 'Warming';
  if (latency < 200) return 'Normal';
  return 'Elevated';
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

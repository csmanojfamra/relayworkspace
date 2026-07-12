export type SystemTone = 'ok' | 'info' | 'warn' | 'idle';

export interface SystemEvent {
  id: string;
  tone: SystemTone;
  text: string;
  timestamp: number;
}

export const TYPING_LINES = [
  'Analyzing...',
  'Compiling response...',
  'Loading context...',
  'Reading memory...',
  'Building output...',
  'Synchronizing session...',
  'Rendering response...',
  'Encrypting packets...',
  'Processing...',
] as const;

export const IDLE_LINES = [
  'Heartbeat OK',
  'Listening...',
  'Connection stable',
  'Packets normal',
  'Idle',
  'Tunnel quiet',
  'Awaiting input...',
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
      return '>';
  }
}

export function packetStatus(latency: number | null, connected: boolean): string {
  if (!connected) return 'Interrupted';
  if (latency == null) return 'Syncing';
  if (latency < 80) return 'Optimal';
  if (latency < 160) return 'Normal';
  return 'Elevated';
}

export function connectionHealth(latency: number | null, connected: boolean, peerConnected: boolean): string {
  if (!connected) return 'Degraded';
  if (!peerConnected) return 'Standby';
  if (latency == null) return 'Stabilizing';
  if (latency < 120) return 'Excellent';
  if (latency < 220) return 'Stable';
  return 'Fair';
}

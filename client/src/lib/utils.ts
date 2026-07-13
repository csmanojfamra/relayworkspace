const envUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

/**
 * Resolve the Socket.IO server URL.
 * Priority: VITE_SOCKET_URL → localhost fallback → same-origin (only if explicitly empty env is intentional).
 */
export function getSocketUrl(): string {
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001`;
    }
  }

  return '';
}

export function isSocketUrlConfigured(): boolean {
  return Boolean(getSocketUrl());
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

/** UTC clock for endpoint history — reads like system logs. */
export function formatUtcTime(ts: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(ts));
  return `${parts} UTC`;
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

export function promptLabel(role: 'host' | 'guest' | 'me' | 'friend'): string {
  if (role === 'me' || role === 'host') return 'LOCAL ENDPOINT';
  return 'REMOTE ENDPOINT';
}


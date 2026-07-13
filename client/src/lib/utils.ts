const envUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

/**
 * Resolve the Socket.IO server URL.
 *
 * Production on relayworkspace.in uses same-origin so Socket.IO is proxied via
 * Vercel → Railway. WhatsApp/Instagram in-app browsers often block direct
 * connections to *.up.railway.app.
 */
export function getSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return (envUrl || `${protocol}//${hostname}:3001`).replace(/\/$/, '');
    }

    // Always same-origin on our deployed hosts (proxied in vercel.json).
    if (
      hostname === 'relayworkspace.in' ||
      hostname === 'www.relayworkspace.in' ||
      hostname.endsWith('.vercel.app')
    ) {
      return origin;
    }
  }

  if (envUrl) return envUrl.replace(/\/$/, '');
  return '';
}

export function isSocketUrlConfigured(): boolean {
  return Boolean(getSocketUrl());
}

/** Resolve attachment URLs against the Socket.IO / API host. */
export function resolveAttachmentUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getSocketUrl().replace(/\/$/, '');
  if (!base) return pathOrUrl;
  return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
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

/** Compact clock for narrow screens — local time, no timezone suffix. */
export function formatCompactTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ts));
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

export function shortPromptLabel(role: 'host' | 'guest' | 'me' | 'friend'): string {
  if (role === 'me' || role === 'host') return 'LOCAL';
  return 'REMOTE';
}

import { customAlphabet } from 'nanoid';

const roomAlphabet = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);
const tokenAlphabet = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  40
);
const idAlphabet = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  21
);

export function generateRoomId(): string {
  return roomAlphabet();
}

export function generateInviteToken(): string {
  return tokenAlphabet();
}

export function generateId(): string {
  return idAlphabet();
}

export function getClientOrigin(): string {
  return process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
}

/** Apex + www (and optional CLIENT_ORIGINS) so mobile / www links don't fail CORS. */
export function getAllowedOrigins(): string[] {
  const primary = getClientOrigin().replace(/\/$/, '');
  const origins = new Set<string>([primary]);

  try {
    const url = new URL(primary);
    if (url.hostname.startsWith('www.')) {
      origins.add(`${url.protocol}//${url.hostname.slice(4)}`);
    } else if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      origins.add(`${url.protocol}//www.${url.hostname}`);
    }
  } catch {
    // ignore malformed CLIENT_ORIGIN
  }

  for (const extra of (process.env.CLIENT_ORIGINS ?? '').split(',')) {
    const origin = extra.trim().replace(/\/$/, '');
    if (origin) origins.add(origin);
  }

  return [...origins];
}

export function getPort(): number {
  return Number(process.env.PORT ?? 3001);
}

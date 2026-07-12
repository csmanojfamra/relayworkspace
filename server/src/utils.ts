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

export function getPort(): number {
  return Number(process.env.PORT ?? 3001);
}

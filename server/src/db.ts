import pg from 'pg';
import type { ChatMessage, InviteStatus } from '@terminalchat/shared';
import type { PendingJoinRequest, Room } from './rooms.js';

const { Pool } = pg;

export interface RoomSnapshot {
  roomId: string;
  hostSessionKey: string | null;
  guestSessionKey: string | null;
  inviteToken: string | null;
  inviteStatus: InviteStatus;
  locked: boolean;
  messages: ChatMessage[];
  createdAt: number;
  pendingRequest: PendingJoinRequest | null;
}

let pool: pg.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): pg.Pool | null {
  if (!isDatabaseConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return pool;
}

export async function initDatabase(): Promise<boolean> {
  const db = getPool();
  if (!db) {
    console.log('DATABASE_URL not set — rooms stay in memory only');
    return false;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id TEXT PRIMARY KEY,
      host_session_key TEXT,
      guest_session_key TEXT,
      invite_token TEXT,
      invite_status TEXT NOT NULL DEFAULT 'active',
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      pending_request JSONB,
      created_at BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS rooms_invite_token_uidx
      ON rooms (invite_token)
      WHERE invite_token IS NOT NULL;
  `);

  console.log('Postgres ready — room persistence enabled');
  return true;
}

export function roomToSnapshot(room: Room): RoomSnapshot {
  return {
    roomId: room.roomId,
    hostSessionKey: room.hostSessionKey,
    guestSessionKey: room.guestSessionKey,
    inviteToken: room.inviteToken,
    inviteStatus: room.inviteStatus,
    locked: room.locked,
    messages: room.messages,
    createdAt: room.createdAt,
    // Live sockets die with the process — guests re-request after restart.
    pendingRequest: null,
  };
}

export async function loadRoomSnapshots(): Promise<RoomSnapshot[]> {
  const db = getPool();
  if (!db) return [];

  const result = await db.query<{
    room_id: string;
    host_session_key: string | null;
    guest_session_key: string | null;
    invite_token: string | null;
    invite_status: InviteStatus;
    locked: boolean;
    messages: ChatMessage[];
    pending_request: PendingJoinRequest | null;
    created_at: string;
  }>(`
    SELECT room_id, host_session_key, guest_session_key, invite_token,
           invite_status, locked, messages, pending_request, created_at
    FROM rooms
  `);

  return result.rows.map((row) => ({
    roomId: row.room_id,
    hostSessionKey: row.host_session_key,
    guestSessionKey: row.guest_session_key,
    inviteToken: row.invite_token,
    inviteStatus: row.invite_status,
    locked: row.locked,
    messages: Array.isArray(row.messages) ? row.messages : [],
    createdAt: Number(row.created_at),
    pendingRequest: null,
  }));
}

export async function upsertRoomSnapshot(snapshot: RoomSnapshot): Promise<void> {
  const db = getPool();
  if (!db) return;

  await db.query(
    `
    INSERT INTO rooms (
      room_id, host_session_key, guest_session_key, invite_token,
      invite_status, locked, messages, pending_request, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,NOW())
    ON CONFLICT (room_id) DO UPDATE SET
      host_session_key = EXCLUDED.host_session_key,
      guest_session_key = EXCLUDED.guest_session_key,
      invite_token = EXCLUDED.invite_token,
      invite_status = EXCLUDED.invite_status,
      locked = EXCLUDED.locked,
      messages = EXCLUDED.messages,
      pending_request = EXCLUDED.pending_request,
      created_at = EXCLUDED.created_at,
      updated_at = NOW()
  `,
    [
      snapshot.roomId,
      snapshot.hostSessionKey,
      snapshot.guestSessionKey,
      snapshot.inviteToken,
      snapshot.inviteStatus,
      snapshot.locked,
      JSON.stringify(snapshot.messages),
      snapshot.pendingRequest ? JSON.stringify(snapshot.pendingRequest) : null,
      snapshot.createdAt,
    ]
  );
}

export async function deleteRoomSnapshot(roomId: string): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(`DELETE FROM rooms WHERE room_id = $1`, [roomId]);
}

export async function closeDatabase(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

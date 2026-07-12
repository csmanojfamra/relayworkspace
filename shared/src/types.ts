export type ThemeId =
  | 'modern-dark'
  | 'linux-green'
  | 'amber-crt'
  | 'blue-terminal'
  | 'white-terminal';

export type UserRole = 'host' | 'guest';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'verifying'
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type InviteStatus = 'active' | 'used' | 'expired' | 'none';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  timestamp: number;
  delivered: boolean;
  seenByHost: boolean;
  seenByGuest: boolean;
  /** Convenience: both participants have viewed the message */
  seen: boolean;
  /** Epoch ms when the message should be purged; null until both have seen it */
  deleteAt: number | null;
}

export interface MessageDeletedPayload {
  roomId: string;
  messageId: string;
}

/** How long a fully-seen message remains before secure deletion */
export const MESSAGE_TTL_MS = 2 * 60 * 1000;

export interface RoomPublicState {
  roomId: string;
  locked: boolean;
  inviteStatus: InviteStatus;
  createdAt: number;
  hostConnected: boolean;
  guestConnected: boolean;
  peerConnected: boolean;
  peerRole: UserRole | null;
  userCount: number;
  /** Present only for the host while a guest is waiting for authorization */
  pendingRequest: JoinRequestPayload | null;
}

export interface CreateRoomResult {
  roomId: string;
  inviteToken: string;
  inviteUrl: string;
  role: UserRole;
  sessionKey: string;
}

export interface JoinRequestPayload {
  requestId: string;
  roomId: string;
  guestSocketId: string;
  createdAt: number;
}

export interface JoinResult {
  roomId: string;
  role: UserRole;
  messages: ChatMessage[];
  createdAt: number;
  peerConnected: boolean;
  sessionKey: string;
}

export interface TypingPayload {
  roomId: string;
  role: UserRole;
}

export interface SeenPayload {
  roomId: string;
  messageIds: string[];
}

export interface HeartbeatPayload {
  roomId: string;
  latency?: number;
}

export interface ErrorPayload {
  code:
    | 'INVALID_INVITE'
    | 'EXPIRED_INVITE'
    | 'ROOM_FULL'
    | 'ROOM_NOT_FOUND'
    | 'HOST_LEFT'
    | 'GUEST_LEFT'
    | 'UNAUTHORIZED'
    | 'ALREADY_JOINED'
    | 'SERVER_ERROR';
  message: string;
}

export interface PeerStatusPayload {
  connected: boolean;
  role: UserRole | null;
  reason?: 'disconnect' | 'reject' | 'left';
}

export interface LatencyUpdate {
  latency: number;
}

import type {
  ChatMessage,
  InviteStatus,
  RoomPublicState,
  UserRole,
} from '@terminalchat/shared';
import { MESSAGE_TTL_MS } from '@terminalchat/shared';

export interface PendingJoinRequest {
  requestId: string;
  guestSocketId: string;
  createdAt: number;
}

export interface Room {
  roomId: string;
  hostSocketId: string | null;
  guestSocketId: string | null;
  hostSessionKey: string | null;
  guestSessionKey: string | null;
  inviteToken: string | null;
  inviteStatus: InviteStatus;
  locked: boolean;
  messages: ChatMessage[];
  createdAt: number;
  pendingRequest: PendingJoinRequest | null;
}

export class RoomStore {
  private rooms = new Map<string, Room>();
  private tokenIndex = new Map<string, string>();
  private socketIndex = new Map<string, { roomId: string; role: UserRole }>();

  createRoom(
    hostSocketId: string,
    inviteToken: string,
    roomId: string,
    hostSessionKey: string
  ): Room {
    const room: Room = {
      roomId,
      hostSocketId,
      guestSocketId: null,
      hostSessionKey,
      guestSessionKey: null,
      inviteToken,
      inviteStatus: 'active',
      locked: false,
      messages: [],
      createdAt: Date.now(),
      pendingRequest: null,
    };

    this.rooms.set(roomId, room);
    this.tokenIndex.set(inviteToken, roomId);
    this.socketIndex.set(hostSocketId, { roomId, role: 'host' });
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByToken(token: string): Room | undefined {
    const roomId = this.tokenIndex.get(token);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  getSocketBinding(socketId: string) {
    return this.socketIndex.get(socketId);
  }

  setPendingRequest(room: Room, request: PendingJoinRequest): void {
    room.pendingRequest = request;
  }

  clearPendingRequest(room: Room): void {
    room.pendingRequest = null;
  }

  acceptGuest(room: Room, guestSocketId: string, guestSessionKey: string): void {
    room.guestSocketId = guestSocketId;
    room.guestSessionKey = guestSessionKey;
    room.locked = true;
    room.inviteStatus = 'used';
    room.pendingRequest = null;

    if (room.inviteToken) {
      this.tokenIndex.delete(room.inviteToken);
      room.inviteToken = null;
    }

    this.socketIndex.set(guestSocketId, { roomId: room.roomId, role: 'guest' });

    for (const message of room.messages) {
      if (!message.delivered) message.delivered = true;
    }
  }

  rejoin(
    roomId: string,
    sessionKey: string,
    socketId: string
  ): { room: Room; role: UserRole } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.hostSessionKey === sessionKey) {
      if (room.hostSocketId && room.hostSocketId !== socketId) {
        this.socketIndex.delete(room.hostSocketId);
      }
      room.hostSocketId = socketId;
      this.socketIndex.set(socketId, { roomId, role: 'host' });
      for (const message of room.messages) {
        if (!message.delivered) message.delivered = true;
      }
      return { room, role: 'host' };
    }

    if (room.guestSessionKey === sessionKey) {
      if (room.guestSocketId && room.guestSocketId !== socketId) {
        this.socketIndex.delete(room.guestSocketId);
      }
      room.guestSocketId = socketId;
      this.socketIndex.set(socketId, { roomId, role: 'guest' });
      for (const message of room.messages) {
        if (!message.delivered) message.delivered = true;
      }
      return { room, role: 'guest' };
    }

    return null;
  }

  rejectGuest(room: Room): void {
    room.pendingRequest = null;
  }

  addMessage(room: Room, message: ChatMessage): void {
    room.messages.push(message);
    if (room.messages.length > 500) {
      room.messages = room.messages.slice(-500);
    }
  }

  removeMessage(roomId: string, messageId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const before = room.messages.length;
    room.messages = room.messages.filter((m) => m.id !== messageId);
    return room.messages.length < before;
  }

  markSeen(room: Room, messageIds: string[], viewerRole: UserRole): ChatMessage[] {
    const updated: ChatMessage[] = [];
    const idSet = new Set(messageIds);

    for (const message of room.messages) {
      if (!idSet.has(message.id)) continue;

      let changed = false;

      if (viewerRole === 'host' && !message.seenByHost) {
        message.seenByHost = true;
        changed = true;
      }
      if (viewerRole === 'guest' && !message.seenByGuest) {
        message.seenByGuest = true;
        changed = true;
      }

      const bothSeen = message.seenByHost && message.seenByGuest;
      if (bothSeen && !message.seen) {
        message.seen = true;
        changed = true;
      }

      if (bothSeen && message.deleteAt == null) {
        message.deleteAt = Date.now() + MESSAGE_TTL_MS;
        changed = true;
      }

      if (changed) updated.push({ ...message });
    }

    return updated;
  }

  rebindSocket(
    room: Room,
    role: UserRole,
    newSocketId: string,
    previousSocketId?: string | null
  ): void {
    if (previousSocketId) {
      this.socketIndex.delete(previousSocketId);
    }

    if (role === 'host') {
      room.hostSocketId = newSocketId;
    } else {
      room.guestSocketId = newSocketId;
    }

    this.socketIndex.set(newSocketId, { roomId: room.roomId, role });
  }

  detachSocket(socketId: string): { room: Room; role: UserRole; destroyed: boolean } | null {
    const binding = this.socketIndex.get(socketId);
    if (!binding) return null;

    const room = this.rooms.get(binding.roomId);
    if (!room) {
      this.socketIndex.delete(socketId);
      return null;
    }

    this.socketIndex.delete(socketId);

    if (binding.role === 'host' && room.hostSocketId === socketId) {
      room.hostSocketId = null;
    }

    if (binding.role === 'guest' && room.guestSocketId === socketId) {
      room.guestSocketId = null;
    }

    if (room.pendingRequest?.guestSocketId === socketId) {
      room.pendingRequest = null;
    }

    const bothGone = !room.hostSocketId && !room.guestSocketId && !room.pendingRequest;
    if (bothGone) {
      this.destroyRoom(room.roomId);
      return { room, role: binding.role, destroyed: true };
    }

    return { room, role: binding.role, destroyed: false };
  }

  destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.inviteToken) {
      this.tokenIndex.delete(room.inviteToken);
    }

    if (room.hostSocketId) this.socketIndex.delete(room.hostSocketId);
    if (room.guestSocketId) this.socketIndex.delete(room.guestSocketId);

    room.messages = [];
    this.rooms.delete(roomId);
  }

  getPeerSocketId(room: Room, role: UserRole): string | null {
    return role === 'host' ? room.guestSocketId : room.hostSocketId;
  }

  toPublicState(room: Room, viewerRole: UserRole): RoomPublicState {
    const hostConnected = Boolean(room.hostSocketId);
    const guestConnected = Boolean(room.guestSocketId);
    const peerConnected = viewerRole === 'host' ? guestConnected : hostConnected;

    return {
      roomId: room.roomId,
      locked: room.locked,
      inviteStatus: room.inviteStatus,
      createdAt: room.createdAt,
      hostConnected,
      guestConnected,
      peerConnected,
      peerRole: peerConnected ? (viewerRole === 'host' ? 'guest' : 'host') : null,
      userCount: Number(hostConnected) + Number(guestConnected),
    };
  }
}

export const roomStore = new RoomStore();

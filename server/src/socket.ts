import type { Server, Socket } from 'socket.io';
import {
  SocketEvents,
  type ChatMessage,
  type CreateRoomResult,
  type ErrorPayload,
  type HeartbeatPayload,
  type JoinRequestPayload,
  type JoinResult,
  type SeenPayload,
  type TypingPayload,
} from '@terminalchat/shared';
import { bindEphemeralIO, clearMessageTimer, clearRoomTimers } from './ephemeral.js';
import { roomStore } from './rooms.js';
import { generateId, generateInviteToken, generateRoomId, getClientOrigin } from './utils.js';

function emitError(socket: Socket, payload: ErrorPayload): void {
  socket.emit(SocketEvents.ERROR, payload);
}

function buildInviteUrl(roomId: string, token: string): string {
  const origin = getClientOrigin().replace(/\/$/, '');
  return `${origin}/join/${roomId}?token=${token}`;
}

/**
 * Single-use invites are one guest seat. Mobile reconnects often create a new
 * socket while the previous one is still briefly alive — always bind pending
 * to the latest valid join so the host authorizes the live client.
 */
function releaseSupersededPendingGuest(
  io: Server,
  room: { roomId: string; pendingRequest: { guestSocketId: string } | null },
  nextSocketId: string
): void {
  const previousId = room.pendingRequest?.guestSocketId;
  if (!previousId || previousId === nextSocketId) return;

  const previous = io.sockets.sockets.get(previousId);
  if (!previous) return;

  void previous.leave(room.roomId);
  previous.emit(SocketEvents.ERROR, {
    code: 'ROOM_FULL',
    message: 'Access request moved to your latest connection.',
  });
}

function notifyHostOfJoinRequest(
  io: Server,
  room: {
    roomId: string;
    hostSocketId: string | null;
  },
  request: JoinRequestPayload,
  hostState: ReturnType<typeof roomStore.toPublicState>
): void {
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit(SocketEvents.JOIN_REQUEST, request);
    io.to(room.hostSocketId).emit(SocketEvents.ROOM_STATE, hostState);
  }
  // Host is also in the room channel — covers a stale hostSocketId briefly
  // after reconnect before rejoin updates the seat map.
  io.to(room.roomId).emit(SocketEvents.JOIN_REQUEST, request);
}

export function registerSocketHandlers(io: Server): void {
  bindEphemeralIO(io);

  io.on('connection', (socket: Socket) => {
    socket.on(SocketEvents.CREATE_ROOM, (ack?: (result: CreateRoomResult) => void) => {
      try {
        const roomId = generateRoomId();
        const inviteToken = generateInviteToken();
        const sessionKey = generateId();
        const room = roomStore.createRoom(socket.id, inviteToken, roomId, sessionKey);

        void socket.join(roomId);

        const result: CreateRoomResult = {
          roomId,
          inviteToken,
          inviteUrl: buildInviteUrl(roomId, inviteToken),
          role: 'host',
          sessionKey,
        };

        socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'host'));
        ack?.(result);
      } catch {
        emitError(socket, {
          code: 'SERVER_ERROR',
          message: 'Failed to create workspace.',
        });
      }
    });

    socket.on(
      SocketEvents.REJOIN,
      (
        payload: { roomId: string; sessionKey: string },
        ack?: (result: JoinResult | ErrorPayload) => void
      ) => {
        const roomBefore = roomStore.getRoom(payload.roomId);
        const undeliveredIds = new Set(
          roomBefore?.messages.filter((m) => !m.delivered).map((m) => m.id) ?? []
        );

        const rejoined = roomStore.rejoin(payload.roomId, payload.sessionKey, socket.id);
        if (!rejoined) {
          // Stale browser session after restart / room purge — ack only, no hard error.
          const error: ErrorPayload = {
            code: 'ROOM_NOT_FOUND',
            message: 'Unable to restore workspace.',
          };
          ack?.(error);
          return;
        }

        const { room, role } = rejoined;
        void socket.join(room.roomId);

        const peerId = roomStore.getPeerSocketId(room, role);
        if (peerId) {
          io.to(peerId).emit(SocketEvents.PEER_STATUS, {
            connected: true,
            role,
          });
        }

        // Sync delivery flags for entries written while this endpoint was offline.
        if (undeliveredIds.size > 0) {
          for (const message of room.messages) {
            if (!undeliveredIds.has(message.id)) continue;
            io.to(room.roomId).emit(SocketEvents.MESSAGE_UPDATED, { ...message });
          }
        }

        const result: JoinResult = {
          roomId: room.roomId,
          role,
          messages: room.messages,
          createdAt: room.createdAt,
          peerConnected: Boolean(peerId),
          sessionKey: payload.sessionKey,
        };

        socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, role));

        // If a guest is still waiting, deliver the authorization card again.
        if (role === 'host' && room.pendingRequest) {
          const request: JoinRequestPayload = {
            requestId: room.pendingRequest.requestId,
            roomId: room.roomId,
            guestSocketId: room.pendingRequest.guestSocketId,
            createdAt: room.pendingRequest.createdAt,
          };
          socket.emit(SocketEvents.JOIN_REQUEST, request);
        }

        ack?.(result);
      }
    );

    socket.on(
      SocketEvents.JOIN_ROOM,
      (
        payload: { roomId: string; token: string },
        ack?: (result: { status: 'pending' } | JoinResult | ErrorPayload) => void
      ) => {
        try {
          const { roomId: rawRoomId, token: rawToken } = payload;
          const roomId = rawRoomId?.trim().toUpperCase() ?? '';
          const token = rawToken?.trim() ?? '';
          const room = roomStore.getRoom(roomId);

          if (!room) {
            const error: ErrorPayload = {
              code: 'ROOM_NOT_FOUND',
              message: 'Workspace not found.',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          if (room.locked || room.guestSocketId) {
            const error: ErrorPayload = {
              code: 'ROOM_FULL',
              message: 'Workspace Full',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          if (!room.inviteToken || room.inviteStatus !== 'active') {
            const error: ErrorPayload = {
              code: 'EXPIRED_INVITE',
              message: 'Invite Expired',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          if (room.inviteToken !== token) {
            const error: ErrorPayload = {
              code: 'INVALID_INVITE',
              message: 'Invalid Invite',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          // Latest valid invite join wins — do not block on a briefly-alive
          // prior socket from the same (or another) guest device.
          releaseSupersededPendingGuest(io, room, socket.id);

          const sameGuest = room.pendingRequest?.guestSocketId === socket.id;
          const requestId = sameGuest
            ? room.pendingRequest!.requestId
            : generateId();
          const createdAt = sameGuest
            ? room.pendingRequest!.createdAt
            : Date.now();

          roomStore.setPendingRequest(room, {
            requestId,
            guestSocketId: socket.id,
            createdAt,
          });

          const request: JoinRequestPayload = {
            requestId,
            roomId,
            guestSocketId: socket.id,
            createdAt,
          };

          // Join only after host authorizes — keeps chat room to accepted seats.
          notifyHostOfJoinRequest(
            io,
            room,
            request,
            roomStore.toPublicState(room, 'host')
          );
          ack?.({ status: 'pending' });
        } catch {
          const error: ErrorPayload = {
            code: 'SERVER_ERROR',
            message: 'Failed to join workspace.',
          };
          emitError(socket, error);
          ack?.(error);
        }
      }
    );

    socket.on(
      SocketEvents.RESEND_JOIN_REQUEST,
      (
        payload: { roomId: string; token: string },
        ack?: (result: { status: 'pending' } | ErrorPayload) => void
      ) => {
        const room = roomStore.getRoom(payload.roomId?.trim().toUpperCase() ?? '');
        if (!room) {
          const error: ErrorPayload = {
            code: 'ROOM_NOT_FOUND',
            message: 'Workspace not found.',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        if (room.locked || room.guestSocketId) {
          const error: ErrorPayload = {
            code: 'ROOM_FULL',
            message: 'Workspace Full',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        if (!room.inviteToken || room.inviteStatus !== 'active') {
          const error: ErrorPayload = {
            code: 'EXPIRED_INVITE',
            message: 'Invite Expired',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        if (room.inviteToken !== payload.token?.trim()) {
          const error: ErrorPayload = {
            code: 'INVALID_INVITE',
            message: 'Invalid Invite',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        releaseSupersededPendingGuest(io, room, socket.id);

        const sameGuest = room.pendingRequest?.guestSocketId === socket.id;
        const requestId = sameGuest
          ? room.pendingRequest!.requestId
          : generateId();
        const createdAt = sameGuest
          ? room.pendingRequest!.createdAt
          : Date.now();

        roomStore.setPendingRequest(room, {
          requestId,
          guestSocketId: socket.id,
          createdAt,
        });

        const request: JoinRequestPayload = {
          requestId,
          roomId: room.roomId,
          guestSocketId: socket.id,
          createdAt,
        };

        if (!room.hostSocketId) {
          const error: ErrorPayload = {
            code: 'HOST_LEFT',
            message: 'Host is offline. Keep this open — retry when they return.',
          };
          // Pending is stored; host will see it on rejoin via GET_PENDING / REJOIN.
          ack?.(error);
          return;
        }

        notifyHostOfJoinRequest(
          io,
          room,
          request,
          roomStore.toPublicState(room, 'host')
        );
        ack?.({ status: 'pending' });
      }
    );

    socket.on(
      SocketEvents.GET_PENDING_REQUEST,
      (ack?: (request: JoinRequestPayload | null) => void) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding || binding.role !== 'host') {
          ack?.(null);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room?.pendingRequest) {
          ack?.(null);
          return;
        }

        const request: JoinRequestPayload = {
          requestId: room.pendingRequest.requestId,
          roomId: room.roomId,
          guestSocketId: room.pendingRequest.guestSocketId,
          createdAt: room.pendingRequest.createdAt,
        };

        socket.emit(SocketEvents.JOIN_REQUEST, request);
        socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'host'));
        ack?.(request);
      }
    );

    socket.on(
      SocketEvents.ACCEPT_REQUEST,
      (payload: { requestId: string }, ack?: (ok: boolean) => void) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding || binding.role !== 'host') {
          emitError(socket, { code: 'UNAUTHORIZED', message: 'Only the host can authorize.' });
          ack?.(false);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room?.pendingRequest || room.pendingRequest.requestId !== payload.requestId) {
          // Stale authorize card — keep host in session, just drop the request.
          if (room) {
            roomStore.clearPendingRequest(room);
            socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'host'));
          }
          ack?.(false);
          return;
        }

        const guestSocketId = room.pendingRequest.guestSocketId;
        const guestSocket = io.sockets.sockets.get(guestSocketId);

        if (!guestSocket) {
          roomStore.clearPendingRequest(room);
          socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'host'));
          ack?.(false);
          return;
        }

        const guestSessionKey = generateId();
        roomStore.acceptGuest(room, guestSocketId, guestSessionKey);
        void guestSocket.join(room.roomId);

        const guestResult: JoinResult = {
          roomId: room.roomId,
          role: 'guest',
          messages: room.messages,
          createdAt: room.createdAt,
          peerConnected: Boolean(room.hostSocketId),
          sessionKey: guestSessionKey,
        };

        guestSocket.emit(SocketEvents.ROOM_LOCKED, { locked: true });
        guestSocket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'guest'));
        guestSocket.emit('join-approved', guestResult);

        socket.emit(SocketEvents.ROOM_LOCKED, { locked: true });
        socket.emit(SocketEvents.ROOM_STATE, roomStore.toPublicState(room, 'host'));
        socket.emit(SocketEvents.PEER_STATUS, {
          connected: true,
          role: 'guest',
        });

        guestSocket.emit(SocketEvents.PEER_STATUS, {
          connected: true,
          role: 'host',
        });

        ack?.(true);
      }
    );

    socket.on(
      SocketEvents.REJECT_REQUEST,
      (payload: { requestId: string }, ack?: (ok: boolean) => void) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding || binding.role !== 'host') {
          ack?.(false);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room?.pendingRequest || room.pendingRequest.requestId !== payload.requestId) {
          ack?.(false);
          return;
        }

        const guestSocketId = room.pendingRequest.guestSocketId;
        roomStore.rejectGuest(room);

        const guestSocket = io.sockets.sockets.get(guestSocketId);
        guestSocket?.emit(SocketEvents.REQUEST_REJECTED, {
          message: 'Access request was declined.',
        });

        ack?.(true);
      }
    );

    socket.on(
      SocketEvents.SEND_MESSAGE,
      (payload: { content: string }, ack?: (message: ChatMessage | null) => void) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding) {
          emitError(socket, { code: 'UNAUTHORIZED', message: 'Not in a workspace.' });
          ack?.(null);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room) {
          emitError(socket, { code: 'ROOM_NOT_FOUND', message: 'Workspace not found.' });
          ack?.(null);
          return;
        }

        const content = payload.content?.trim();
        if (!content || content.length > 4000) {
          ack?.(null);
          return;
        }

        const peerId = roomStore.getPeerSocketId(room, binding.role);
        const message: ChatMessage = {
          id: generateId(),
          roomId: room.roomId,
          senderId: socket.id,
          senderRole: binding.role,
          content,
          timestamp: Date.now(),
          delivered: Boolean(peerId),
          seenByHost: binding.role === 'host',
          seenByGuest: binding.role === 'guest',
          seen: false,
          deleteAt: null,
        };

        roomStore.addMessage(room, message);
        io.to(room.roomId).emit(SocketEvents.RECEIVE_MESSAGE, message);
        ack?.(message);
      }
    );

    socket.on(
      SocketEvents.EDIT_MESSAGE,
      (
        payload: { messageId: string; content: string },
        ack?: (message: ChatMessage | null) => void
      ) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding) {
          ack?.(null);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room) {
          ack?.(null);
          return;
        }

        const content = payload.content?.trim() ?? '';
        if (!content) {
          const removed = roomStore.removeMessage(room.roomId, payload.messageId);
          if (removed) {
            clearMessageTimer(payload.messageId);
            io.to(room.roomId).emit(SocketEvents.MESSAGE_DELETED, {
              messageId: payload.messageId,
            });
          }
          ack?.(null);
          return;
        }

        if (content.length > 4000) {
          ack?.(null);
          return;
        }

        const updated = roomStore.updateMessageContent(
          room.roomId,
          payload.messageId,
          content
        );
        if (!updated) {
          ack?.(null);
          return;
        }

        io.to(room.roomId).emit(SocketEvents.MESSAGE_UPDATED, updated);
        ack?.(updated);
      }
    );

    socket.on(
      SocketEvents.CLEAR_MESSAGES,
      (ack?: (result: { ok: boolean; cleared: number } | ErrorPayload) => void) => {
        const binding = roomStore.getSocketBinding(socket.id);
        if (!binding) {
          const error: ErrorPayload = {
            code: 'UNAUTHORIZED',
            message: 'Not in a workspace.',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        const room = roomStore.getRoom(binding.roomId);
        if (!room) {
          const error: ErrorPayload = {
            code: 'ROOM_NOT_FOUND',
            message: 'Workspace not found.',
          };
          emitError(socket, error);
          ack?.(error);
          return;
        }

        clearRoomTimers(room.roomId);
        const cleared = roomStore.clearMessages(room);
        io.to(room.roomId).emit(SocketEvents.MESSAGES_CLEARED, {
          roomId: room.roomId,
          clearedBy: binding.role,
          cleared,
        });
        ack?.({ ok: true, cleared });
      }
    );

    socket.on(SocketEvents.TYPING_START, () => {
      const binding = roomStore.getSocketBinding(socket.id);
      if (!binding) return;
      const room = roomStore.getRoom(binding.roomId);
      if (!room) return;

      const peerId = roomStore.getPeerSocketId(room, binding.role);
      if (!peerId) return;

      const payload: TypingPayload = { roomId: room.roomId, role: binding.role };
      io.to(peerId).emit(SocketEvents.TYPING_START, payload);
    });

    socket.on(SocketEvents.TYPING_STOP, () => {
      const binding = roomStore.getSocketBinding(socket.id);
      if (!binding) return;
      const room = roomStore.getRoom(binding.roomId);
      if (!room) return;

      const peerId = roomStore.getPeerSocketId(room, binding.role);
      if (!peerId) return;

      const payload: TypingPayload = { roomId: room.roomId, role: binding.role };
      io.to(peerId).emit(SocketEvents.TYPING_STOP, payload);
    });

    socket.on(SocketEvents.SEEN, (payload: SeenPayload) => {
      const binding = roomStore.getSocketBinding(socket.id);
      if (!binding) return;
      const room = roomStore.getRoom(binding.roomId);
      if (!room) return;

      const updated = roomStore.markSeen(room, payload.messageIds, binding.role);
      for (const message of updated) {
        io.to(room.roomId).emit(SocketEvents.MESSAGE_UPDATED, message);
      }
    });

    socket.on(SocketEvents.HEARTBEAT, (payload: HeartbeatPayload, ack?: (ts: number) => void) => {
      const now = Date.now();
      ack?.(now);

      const binding = roomStore.getSocketBinding(socket.id);
      if (!binding) return;
      const room = roomStore.getRoom(binding.roomId);
      if (!room) return;

      if (typeof payload.latency === 'number') {
        const peerId = roomStore.getPeerSocketId(room, binding.role);
        if (peerId) {
          io.to(peerId).emit(SocketEvents.LATENCY, { latency: payload.latency });
        }
      }
    });

    socket.on('disconnect', () => {
      const result = roomStore.detachSocket(socket.id);
      if (!result) return;

      const { room, role, destroyed } = result;
      if (destroyed) {
        clearRoomTimers(room.roomId);
        return;
      }

      const stillExists = roomStore.getRoom(room.roomId);
      if (!stillExists) return;

      // Notify the other side. For a pending (not-yet-accepted) guest this is the
      // host — ROOM_STATE carries pendingRequest: null so the authorize card clears.
      const peerId = roomStore.getPeerSocketId(room, role);
      if (peerId) {
        io.to(peerId).emit(SocketEvents.PEER_STATUS, {
          connected: false,
          role,
          reason: 'disconnect',
        });
        io.to(peerId).emit(
          SocketEvents.ROOM_STATE,
          roomStore.toPublicState(room, role === 'host' ? 'guest' : 'host')
        );
      } else if (role !== 'host' && room.hostSocketId) {
        // Pending guest left while host seat mapping was empty — still refresh host.
        io.to(room.hostSocketId).emit(
          SocketEvents.ROOM_STATE,
          roomStore.toPublicState(room, 'host')
        );
      }
    });
  });
}

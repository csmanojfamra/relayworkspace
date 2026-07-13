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
import { bindEphemeralIO, clearRoomTimers, scheduleMessageDeletion } from './ephemeral.js';
import { roomStore } from './rooms.js';
import { generateId, generateInviteToken, generateRoomId, getClientOrigin } from './utils.js';

function emitError(socket: Socket, payload: ErrorPayload): void {
  socket.emit(SocketEvents.ERROR, payload);
}

function buildInviteUrl(roomId: string, token: string): string {
  const origin = getClientOrigin().replace(/\/$/, '');
  return `${origin}/join/${roomId}?token=${token}`;
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
          const { roomId, token } = payload;
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

          // Refresh an existing request from this guest, or replace a stale one
          // whose socket already disconnected.
          if (room.pendingRequest) {
            const pendingId = room.pendingRequest.guestSocketId;
            const pendingAlive = Boolean(io.sockets.sockets.get(pendingId));
            if (pendingAlive && pendingId !== socket.id) {
              const error: ErrorPayload = {
                code: 'ROOM_FULL',
                message: 'An access request is already pending.',
              };
              emitError(socket, error);
              ack?.(error);
              return;
            }
          }

          void socket.join(roomId);

          const requestId =
            room.pendingRequest?.guestSocketId === socket.id
              ? room.pendingRequest.requestId
              : generateId();
          const createdAt =
            room.pendingRequest?.guestSocketId === socket.id
              ? room.pendingRequest.createdAt
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

          // Deliver via socket id and room channel so the host always sees it.
          if (room.hostSocketId) {
            io.to(room.hostSocketId).emit(SocketEvents.JOIN_REQUEST, request);
            io.to(room.hostSocketId).emit(
              SocketEvents.ROOM_STATE,
              roomStore.toPublicState(room, 'host')
            );
          }
          io.to(roomId).emit(SocketEvents.JOIN_REQUEST, request);
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
        const room = roomStore.getRoom(payload.roomId);
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

        // Reuse existing pending request from this guest, replace a stale one,
        // or create a new request.
        let request: JoinRequestPayload;
        if (
          room.pendingRequest &&
          room.pendingRequest.guestSocketId === socket.id
        ) {
          request = {
            requestId: room.pendingRequest.requestId,
            roomId: room.roomId,
            guestSocketId: socket.id,
            createdAt: room.pendingRequest.createdAt,
          };
        } else if (room.pendingRequest) {
          const pendingAlive = Boolean(
            io.sockets.sockets.get(room.pendingRequest.guestSocketId)
          );
          if (pendingAlive) {
            const error: ErrorPayload = {
              code: 'ROOM_FULL',
              message: 'An access request is already pending.',
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
          if (room.inviteToken !== payload.token) {
            const error: ErrorPayload = {
              code: 'INVALID_INVITE',
              message: 'Invalid Invite',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          const requestId = generateId();
          roomStore.setPendingRequest(room, {
            requestId,
            guestSocketId: socket.id,
            createdAt: Date.now(),
          });
          request = {
            requestId,
            roomId: room.roomId,
            guestSocketId: socket.id,
            createdAt: Date.now(),
          };
        } else {
          if (!room.inviteToken || room.inviteStatus !== 'active') {
            const error: ErrorPayload = {
              code: 'EXPIRED_INVITE',
              message: 'Invite Expired',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }
          if (room.inviteToken !== payload.token) {
            const error: ErrorPayload = {
              code: 'INVALID_INVITE',
              message: 'Invalid Invite',
            };
            emitError(socket, error);
            ack?.(error);
            return;
          }

          const requestId = generateId();
          roomStore.setPendingRequest(room, {
            requestId,
            guestSocketId: socket.id,
            createdAt: Date.now(),
          });
          request = {
            requestId,
            roomId: room.roomId,
            guestSocketId: socket.id,
            createdAt: Date.now(),
          };
        }

        void socket.join(room.roomId);

        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit(SocketEvents.JOIN_REQUEST, request);
          io.to(room.hostSocketId).emit(
            SocketEvents.ROOM_STATE,
            roomStore.toPublicState(room, 'host')
          );
        }
        io.to(room.roomId).emit(SocketEvents.JOIN_REQUEST, request);
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
          emitError(socket, { code: 'EXPIRED_INVITE', message: 'Request is no longer valid.' });
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
        if (message.deleteAt != null) {
          scheduleMessageDeletion(room.roomId, message.id, message.deleteAt);
        }
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

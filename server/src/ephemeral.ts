import type { Server } from 'socket.io';
import { SocketEvents } from '@terminalchat/shared';
import { roomStore } from './rooms.js';

/** messageId → timeout handle */
const deletionTimers = new Map<string, NodeJS.Timeout>();

/** roomId → set of messageIds with active timers */
const roomTimers = new Map<string, Set<string>>();

let ioRef: Server | null = null;

export function bindEphemeralIO(io: Server): void {
  ioRef = io;
}

export function scheduleMessageDeletion(
  roomId: string,
  messageId: string,
  deleteAt: number
): void {
  clearMessageTimer(messageId);

  const delay = Math.max(0, deleteAt - Date.now());
  const timer = setTimeout(() => {
    purgeMessage(roomId, messageId);
  }, delay);

  deletionTimers.set(messageId, timer);

  let set = roomTimers.get(roomId);
  if (!set) {
    set = new Set();
    roomTimers.set(roomId, set);
  }
  set.add(messageId);
}

export function clearMessageTimer(messageId: string): void {
  const timer = deletionTimers.get(messageId);
  if (timer) {
    clearTimeout(timer);
    deletionTimers.delete(messageId);
  }

  for (const [roomId, set] of roomTimers) {
    if (set.delete(messageId) && set.size === 0) {
      roomTimers.delete(roomId);
    }
  }
}

export function clearRoomTimers(roomId: string): void {
  const set = roomTimers.get(roomId);
  if (!set) return;

  for (const messageId of set) {
    const timer = deletionTimers.get(messageId);
    if (timer) clearTimeout(timer);
    deletionTimers.delete(messageId);
  }

  roomTimers.delete(roomId);
}

function purgeMessage(roomId: string, messageId: string): void {
  deletionTimers.delete(messageId);
  const set = roomTimers.get(roomId);
  set?.delete(messageId);
  if (set && set.size === 0) roomTimers.delete(roomId);

  const removed = roomStore.removeMessage(roomId, messageId);
  if (!removed) return;

  ioRef?.to(roomId).emit(SocketEvents.MESSAGE_DELETED, { roomId, messageId });
}

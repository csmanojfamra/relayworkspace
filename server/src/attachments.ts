import {
  MAX_ATTACHMENT_BYTES,
  type AttachmentKind,
  type NoteAttachment,
} from '@terminalchat/shared';
import { generateId } from './utils.js';

export interface StoredAttachment {
  id: string;
  roomId: string;
  messageId: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  data: Buffer;
  createdAt: number;
}

const byId = new Map<string, StoredAttachment>();
const byRoom = new Map<string, Set<string>>();

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const DOC_TYPES = new Set(['application/pdf']);

export function classifyAttachment(mime: string, name: string): AttachmentKind | null {
  const normalized = (mime || '').toLowerCase().trim();
  if (IMAGE_TYPES.has(normalized) || normalized.startsWith('image/')) return 'image';
  if (DOC_TYPES.has(normalized) || normalized.includes('pdf')) return 'document';

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'document';
  return null;
}

export function putAttachment(input: {
  roomId: string;
  messageId: string;
  name: string;
  mime: string;
  data: Buffer;
}): NoteAttachment | null {
  if (!input.data.length || input.data.length > MAX_ATTACHMENT_BYTES) return null;
  const kind = classifyAttachment(input.mime, input.name);
  if (!kind) return null;

  const id = generateId();
  const stored: StoredAttachment = {
    id,
    roomId: input.roomId,
    messageId: input.messageId,
    kind,
    name: input.name.slice(0, 180) || (kind === 'image' ? 'Photo' : 'Document'),
    mime: input.mime || 'application/octet-stream',
    size: input.data.length,
    data: input.data,
    createdAt: Date.now(),
  };

  byId.set(id, stored);
  let set = byRoom.get(input.roomId);
  if (!set) {
    set = new Set();
    byRoom.set(input.roomId, set);
  }
  set.add(id);

  return toPublicAttachment(stored);
}

export function getAttachment(id: string): StoredAttachment | null {
  return byId.get(id) ?? null;
}

export function removeAttachment(id: string): void {
  const stored = byId.get(id);
  if (!stored) return;
  byId.delete(id);
  const set = byRoom.get(stored.roomId);
  if (set) {
    set.delete(id);
    if (set.size === 0) byRoom.delete(stored.roomId);
  }
}

export function removeAttachmentForMessage(
  roomId: string,
  messageId: string,
  attachmentId?: string | null
): void {
  if (attachmentId) {
    const stored = byId.get(attachmentId);
    if (stored && stored.roomId === roomId && stored.messageId === messageId) {
      removeAttachment(attachmentId);
      return;
    }
  }

  const set = byRoom.get(roomId);
  if (!set) return;
  for (const id of [...set]) {
    const stored = byId.get(id);
    if (stored?.messageId === messageId) removeAttachment(id);
  }
}

export function clearRoomAttachments(roomId: string): void {
  const set = byRoom.get(roomId);
  if (!set) return;
  for (const id of [...set]) removeAttachment(id);
}

function toPublicAttachment(stored: StoredAttachment): NoteAttachment {
  return {
    id: stored.id,
    kind: stored.kind,
    name: stored.name,
    mime: stored.mime,
    size: stored.size,
    url: `/api/attachments/${stored.id}`,
  };
}

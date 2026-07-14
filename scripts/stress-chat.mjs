/**
 * Stress-test draft + send reliability between two sockets (host/guest).
 * Run: node --import tsx scripts/stress-chat.mjs  (or via node with socket.io-client)
 */
import { io } from '../node_modules/socket.io-client/build/esm/index.js';
import { SocketEvents } from '../shared/dist/index.js';

const URL = process.env.SOCKET_URL || 'http://localhost:3001';
const TOTAL = 20;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function once(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

async function main() {
  const host = io(URL, { transports: ['websocket'], forceNew: true });
  const guest = io(URL, { transports: ['websocket'], forceNew: true });

  await Promise.all([
    new Promise((r, j) => {
      host.once('connect', r);
      host.once('connect_error', j);
    }),
    new Promise((r, j) => {
      guest.once('connect', r);
      guest.once('connect_error', j);
    }),
  ]);

  const created = await new Promise((resolve, reject) => {
    host.emit(SocketEvents.CREATE_ROOM, (result) => {
      if (!result || result.code) reject(new Error(JSON.stringify(result)));
      else resolve(result);
    });
  });

  const roomId = created.roomId;
  const token = created.inviteToken;

  const joinReqP = once(host, SocketEvents.JOIN_REQUEST);
  guest.emit(SocketEvents.JOIN_ROOM, { roomId, token }, (ack) => {
    if (ack?.code) console.error('join ack error', ack);
  });
  const joinReq = await joinReqP;

  await new Promise((resolve, reject) => {
    host.emit(SocketEvents.ACCEPT_REQUEST, { requestId: joinReq.requestId }, (result) => {
      if (!result || result.code) reject(new Error(JSON.stringify(result)));
      else resolve(result);
    });
  });

  // Wait seats settle
  await wait(200);

  const guestReceived = [];
  const hostReceived = [];
  const guestDrafts = [];

  guest.on(SocketEvents.RECEIVE_MESSAGE, (m) => guestReceived.push(m));
  host.on(SocketEvents.RECEIVE_MESSAGE, (m) => hostReceived.push(m));
  guest.on(SocketEvents.DRAFT_UPDATE, (d) => guestDrafts.push(d));

  // Live draft should stick until message arrives (empty draft must NOT wipe)
  host.emit(SocketEvents.DRAFT_UPDATE, { content: 'hello live', messageId: null });
  await wait(80);
  host.emit(SocketEvents.DRAFT_UPDATE, { content: '', messageId: null });
  await wait(80);

  const sawLiveDraft = guestDrafts.some((d) => d.content === 'hello live');
  const emptyComposerForwarded = guestDrafts.some((d) => d.content === '' && !d.messageId);

  // 20 alternating messages with drafts
  for (let i = 1; i <= TOTAL; i++) {
    const fromHost = i % 2 === 1;
    const sender = fromHost ? host : guest;
    const text = `msg-${i}-stress`;
    sender.emit(SocketEvents.DRAFT_UPDATE, { content: text.slice(0, -1), messageId: null });
    await wait(25);
    await new Promise((resolve, reject) => {
      sender.emit(SocketEvents.SEND_MESSAGE, { content: text }, (ack) => {
        if (!ack) reject(new Error(`no ack for ${text}`));
        else resolve(ack);
      });
    });
    await wait(40);
  }

  await wait(400);

  const hostTexts = hostReceived.map((m) => m.content).filter((c) => c.startsWith('msg-'));
  const guestTexts = guestReceived.map((m) => m.content).filter((c) => c.startsWith('msg-'));

  // Each peer receives broadcasts including own messages via room emit;
  // both should see all TOTAL messages.
  const hostOk = hostTexts.length >= TOTAL;
  const guestOk = guestTexts.length >= TOTAL;
  const missingOnGuest = [];
  for (let i = 1; i <= TOTAL; i++) {
    const t = `msg-${i}-stress`;
    if (!guestTexts.includes(t)) missingOnGuest.push(t);
  }

  console.log(
    JSON.stringify(
      {
        roomId,
        hostCount: hostTexts.length,
        guestCount: guestTexts.length,
        hostOk,
        guestOk,
        missingOnGuest,
        sawLiveDraft,
        emptyComposerForwarded,
        pass: hostOk && guestOk && missingOnGuest.length === 0 && sawLiveDraft && !emptyComposerForwarded,
      },
      null,
      2
    )
  );

  host.close();
  guest.close();
  process.exit(
    hostOk && guestOk && missingOnGuest.length === 0 && sawLiveDraft && !emptyComposerForwarded
      ? 0
      : 1
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import {
  deleteRoomSnapshot,
  initDatabase,
  isDatabaseConfigured,
  loadRoomSnapshots,
  roomToSnapshot,
  upsertRoomSnapshot,
} from './db.js';
import { getAttachment } from './attachments.js';
import { attachRedisAdapter } from './redis.js';
import { registerSocketHandlers } from './socket.js';
import { roomStore } from './rooms.js';
import { getAllowedOrigins, getPort } from './utils.js';

/** ~5MB files + Socket.IO framing overhead */
const MAX_HTTP_BUFFER = 6 * 1024 * 1024;

async function main(): Promise<void> {
  const app = express();
  const server = http.createServer(app);
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients / same-origin tools with no Origin header.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'relay',
      storage: isDatabaseConfigured() ? 'postgres+memory' : 'memory',
      redis: Boolean(process.env.REDIS_URL?.trim()),
      timestamp: Date.now(),
    });
  });

  app.get('/api', (_req, res) => {
    res.json({
      name: 'Relay API',
      status: 'online',
      docs: 'Connect via Socket.IO',
    });
  });

  app.get('/api/attachments/:id', (req, res) => {
    const stored = getAttachment(req.params.id);
    if (!stored) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const safeName = stored.name.replace(/[^\w.\- ()[\]]+/g, '_');
    const inline =
      stored.kind === 'image' ||
      stored.mime.toLowerCase() === 'application/pdf' ||
      stored.name.toLowerCase().endsWith('.pdf');
    res.setHeader('Content-Type', stored.mime);
    res.setHeader('Content-Length', String(stored.size));
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    // Allow same-origin / proxied clients to embed PDF previews.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(stored.data);
  });

  const staticDir = process.env.STATIC_DIR?.trim();
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io')) return next();
      if (req.path.startsWith('/health') || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(staticDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
    console.log(`Serving client from ${staticDir}`);
  } else {
    app.get('/', (_req, res) => {
      res.json({
        name: 'Relay API',
        status: 'online',
        docs: 'Connect via Socket.IO',
      });
    });
  }

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: MAX_HTTP_BUFFER,
  });

  try {
    await attachRedisAdapter(io);
  } catch (err) {
    console.warn('Redis adapter unavailable, continuing without it:', err);
  }

  const dbReady = await initDatabase();
  if (dbReady) {
    roomStore.setPersistHandlers({
      upsert: (room) => {
        void upsertRoomSnapshot(roomToSnapshot(room)).catch((err) => {
          console.error('Failed to persist room', room.roomId, err);
        });
      },
      remove: (roomId) => {
        void deleteRoomSnapshot(roomId).catch((err) => {
          console.error('Failed to delete room', roomId, err);
        });
      },
    });

    const snapshots = await loadRoomSnapshots();
    const loaded = roomStore.hydrate(snapshots);
    console.log(`Hydrated ${loaded} room(s) from Postgres`);
  }

  registerSocketHandlers(io);

  const port = getPort();
  server.listen(port, () => {
    console.log(`Relay server listening on :${port}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});

import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket.js';
import { getAllowedOrigins, getPort } from './utils.js';

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
    storage: 'memory',
    timestamp: Date.now(),
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Relay API',
    status: 'online',
    docs: 'Connect via Socket.IO',
  });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

registerSocketHandlers(io);

const port = getPort();

server.listen(port, () => {
  console.log(`Relay server listening on :${port}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
});

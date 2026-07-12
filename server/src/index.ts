import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket.js';
import { getClientOrigin, getPort } from './utils.js';

const app = express();
const server = http.createServer(app);
const clientOrigin = getClientOrigin();

app.use(
  cors({
    origin: clientOrigin,
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
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

registerSocketHandlers(io);

const port = getPort();

server.listen(port, () => {
  console.log(`Relay server listening on :${port}`);
  console.log(`CORS origin: ${clientOrigin}`);
});

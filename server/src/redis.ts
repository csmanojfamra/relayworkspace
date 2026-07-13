import type { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export async function attachRedisAdapter(io: Server): Promise<boolean> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.log('REDIS_URL not set — single-node Socket.IO only');
    return false;
  }

  const pubClient = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  const subClient = pubClient.duplicate();

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      pubClient.once('ready', () => resolve());
      pubClient.once('error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      subClient.once('ready', () => resolve());
      subClient.once('error', reject);
    }),
  ]);

  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis Socket.IO adapter attached');
  return true;
}

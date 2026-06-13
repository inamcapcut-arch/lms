import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub.
 *
 * In a multi-replica deployment, the default in-memory Socket.IO server only
 * knows about sockets connected to its own process. `server.to(room).emit(...)`
 * would therefore silently fail to reach students connected to other api
 * replicas. The Redis adapter broadcasts room events across all replicas via
 * pub/sub so real-time events (auto-submit, submit, session preemption) are
 * delivered regardless of which replica a client is connected to.
 *
 * Note: the pub and sub clients MUST be dedicated connections, separate from
 * the application command client, because a subscribed connection cannot issue
 * normal commands.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.pubClient = new Redis(url, { maxRetriesPerRequest: null });
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) =>
      this.logger.error(`Socket.IO Redis pub client error: ${err.message}`),
    );
    this.subClient.on('error', (err) =>
      this.logger.error(`Socket.IO Redis sub client error: ${err.message}`),
    );

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter connected.');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async close(): Promise<void> {
    try {
      if (this.pubClient) this.pubClient.disconnect();
      if (this.subClient) this.subClient.disconnect();
    } catch (err: any) {
      this.logger.warn(`Error closing Socket.IO Redis adapter clients: ${err.message}`);
    }
  }
}

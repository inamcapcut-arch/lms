import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'attempts',
})
@Injectable()
export class AttemptsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AttemptsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) {
        this.logger.warn(`Connection rejected: No auth token provided for socket ${client.id}`);
        client.disconnect();
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super-secret-development-key',
      });

      // Fetch user and ensure status is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { student: true },
      });

      if (!user || user.status !== 'ACTIVE' || !user.student) {
        this.logger.warn(`Connection rejected: User invalid, inactive, or not a student for socket ${client.id}`);
        client.disconnect();
        return;
      }

      client.data.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        studentId: user.student.id,
      };

      this.logger.log(`Client connected: Socket ID ${client.id}, User ID ${user.id}`);
    } catch (err) {
      this.logger.error(`Connection authentication failed for socket ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: Socket ID ${client.id}`);
    const attemptId = client.data.attemptId;
    if (attemptId) {
      const redisKey = `attempt:${attemptId}:session`;
      const session = await this.redisService.getClient().hgetall(redisKey);
      if (session && session.socketId === client.id) {
        // Clear session if it's the active socket
        await this.redisService.getClient().del(redisKey);
        this.logger.log(`Cleared active Redis session for attempt ${attemptId} on disconnect`);
      }
    }
  }

  @SubscribeMessage('join_attempt')
  async handleJoinAttempt(client: Socket, payload: { attemptId: string; deviceId: string }) {
    const { attemptId, deviceId } = payload;
    const user = client.data.user;

    if (!user) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    try {
      // 1. Verify attempt exists, is ACTIVE, and belongs to this student
      const attempt = await this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          examAssignment: true,
        },
      });

      if (!attempt) {
        client.emit('error', { message: 'Attempt not found' });
        return;
      }

      if (attempt.examAssignment.studentId !== user.studentId) {
        client.emit('error', { message: 'Forbidden: Attempt does not belong to student' });
        return;
      }

      if (attempt.status !== 'ACTIVE') {
        client.emit('error', { message: 'Attempt is not active' });
        return;
      }

      // 2. Active Session Preemption Check
      const redisKey = `attempt:${attemptId}:session`;
      const existingSession = await this.redisService.getClient().hgetall(redisKey);

      if (existingSession && existingSession.socketId && existingSession.deviceId !== deviceId) {
        this.logger.log(
          `Preempting existing session for attempt ${attemptId}. Old Socket: ${existingSession.socketId}, New Socket: ${client.id}`,
        );

        // Tell the old socket it is superseded
        this.server.to(existingSession.socketId).emit('session_superseded', {
          message: 'Exam is active in another window or tab. This session has been disconnected.',
        });

        // Disconnect old socket
        const oldSocket = this.server.sockets.sockets.get(existingSession.socketId);
        if (oldSocket) {
          oldSocket.disconnect();
        }
      }

      // 3. Save new session in Redis
      await this.redisService.getClient().hset(redisKey, {
        socketId: client.id,
        deviceId: deviceId,
        studentId: user.studentId,
        joinedAt: new Date().toISOString(),
      });
      // Set TTL to 24 hours (86400 seconds) to match draft retention
      await this.redisService.getClient().expire(redisKey, 86400);

      // Attach attemptId to client metadata for disconnection cleanup
      client.data.attemptId = attemptId;

      // Join room
      client.join(`attempt_room:${attemptId}`);

      client.emit('joined_attempt', {
        attemptId,
        message: 'Successfully joined attempt session',
      });

      this.logger.log(`Student ${user.id} joined attempt room ${attemptId} with socket ${client.id}`);
    } catch (err) {
      this.logger.error(`Error joining attempt ${attemptId}: ${err.message}`);
      client.emit('error', { message: 'Failed to join attempt session' });
    }
  }
}

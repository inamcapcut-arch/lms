import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from '@alex/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { ActivityService } from '../activity/activity.service';
import { ActivityType, Role } from '@alex/database';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly activityService: ActivityService,
  ) {}

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: loginDto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Single Active Login: Revoke previous sessions
    await this.prisma.session.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: { isRevoked: true },
    });
    
    // Also remove from Redis
    const redis = this.redisService.getClient();
    const existingSessionKey = `session:${user.id}`;
    await redis.del(existingSessionKey);

    // Create new session
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, sessionId: session.id };
    const accessToken = this.jwtService.sign(payload);

    // Cache valid session in Redis for quick access
    await redis.set(existingSessionKey, session.id, 'EX', 60 * 60 * 24 * 7);

    // Log activity if student
    if (user.role === Role.STUDENT) {
      await this.activityService.logActivity(
        ActivityType.STUDENT_LOGGED_IN,
        `Student ${user.name || user.email} logged in`,
        user.id,
        { ipAddress, userAgent }
      );
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  }

  async rotateSession(oldRefreshToken: string, ipAddress: string, userAgent: string) {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken: oldRefreshToken, isRevoked: false },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        // Token reuse / theft / expiration: revoke all user sessions as a security precaution
        await this.prisma.session.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
        await this.redisService.getClient().del(`session:${session.userId}`);
      }
      throw new UnauthorizedException('Session is invalid, revoked, or expired');
    }

    // Generate new tokens (Rotation)
    const newRefreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const payload = { sub: session.user.id, email: session.user.email, role: session.user.role, sessionId: session.id };
    const accessToken = this.jwtService.sign(payload);

    // Update Redis cache
    const existingSessionKey = `session:${session.user.id}`;
    await this.redisService.getClient().set(existingSessionKey, session.id, 'EX', 60 * 60 * 24 * 7);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        name: session.user.name,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken },
    });

    if (session) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      const existingSessionKey = `session:${session.userId}`;
      await this.redisService.getClient().del(existingSessionKey);
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        status: true,
        student: {
          select: {
            id: true,
            registrationNumber: true,
            batch: true,
            department: true,
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}

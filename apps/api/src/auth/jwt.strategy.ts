import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-development-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid token structure');
    }

    const redis = this.redisService.getClient();
    const cachedSessionId = await redis.get(`session:${user.id}`);

    if (cachedSessionId) {
      if (cachedSessionId !== payload.sessionId) {
        throw new UnauthorizedException('Session has been revoked');
      }
    } else {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      await redis.set(`session:${user.id}`, session.id, 'EX', 60 * 60 * 24 * 7);
    }

    return { id: user.id, email: user.email, role: user.role, sessionId: payload.sessionId };
  }
}

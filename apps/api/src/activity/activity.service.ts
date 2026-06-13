import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityType } from '@alex/database';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(type: ActivityType, label: string, userId?: string, metadata?: any) {
    try {
      return await this.prisma.activity.create({
        data: {
          type,
          label,
          userId,
          metadata: metadata || undefined,
        },
      });
    } catch (err) {
      console.error('Error logging activity:', err);
      // Silent fail to ensure primary action does not rollback on log error
    }
  }

  async getRecentActivities(page = 1, limit = 8) {
    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.activity.count(),
    ]);

    return {
      data: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

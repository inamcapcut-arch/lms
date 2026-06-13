import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import * as bcrypt from 'bcrypt';
import { Role, AccountStatus } from '@alex/database';

@Injectable()
export class TrainersService {
  constructor(private prisma: PrismaService) {}

  async createTrainer(dto: CreateTrainerDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: Role.TRAINER,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async getAllTrainers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereClause = search
      ? {
          role: Role.TRAINER,
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : { role: Role.TRAINER };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      data: users.map(({ passwordHash, ...user }) => user),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateTrainer(id: string, dto: UpdateTrainerDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.TRAINER) {
      throw new NotFoundException('Trainer not found');
    }

    const data: any = {};
    if (dto.email) data.email = dto.email;
    if (dto.name) data.name = dto.name;
    if (dto.status) data.status = dto.status as AccountStatus;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async deleteTrainer(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.TRAINER) {
      throw new NotFoundException('Trainer not found');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Trainer deleted successfully' };
  }
}

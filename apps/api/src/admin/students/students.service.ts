import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import * as bcrypt from 'bcrypt';
import { Role, ActivityType } from '@alex/database';
import { ActivityService } from '../../activity/activity.service';
import csv = require('csv-parser');
import { Readable } from 'stream';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async createStudent(createStudentDto: CreateStudentDto) {
    const { email, name, password, batch, registrationNumber, department } = createStudentDto;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const regNo = registrationNumber || `STU-${Date.now()}`;
    const dept = department || 'General';

    if (registrationNumber) {
      const existingStudent = await this.prisma.student.findUnique({ where: { registrationNumber: regNo } });
      if (existingStudent) {
        throw new ConflictException('Student with this registration number already exists');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: Role.STUDENT,
        student: {
          create: {
            registrationNumber: regNo,
            batch,
            department: dept,
          },
        },
      },
      include: {
        student: true,
      },
    });

    // Log Activity
    await this.activityService.logActivity(
      ActivityType.STUDENT_CREATED,
      `Student ${user.name || user.email} account created`,
      user.id
    );

    await this.activityService.logActivity(
      ActivityType.BATCH_ASSIGNED,
      `Student ${user.name || user.email} assigned to batch ${batch}`,
      user.id
    );

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async getAllStudents(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereClause = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { student: { registrationNumber: { contains: search, mode: 'insensitive' as const } } },
          ],
          role: Role.STUDENT,
        }
      : { role: Role.STUDENT };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { student: true },
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

  async deleteStudent(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.STUDENT) {
      throw new NotFoundException('Student not found');
    }

    await this.activityService.logActivity(
      ActivityType.ACCOUNT_DELETED,
      `Student account for ${user.name || user.email} was deleted`,
      userId
    );

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'Student deleted successfully' };
  }

  async updateStudent(id: string, updateStudentDto: UpdateStudentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { student: true },
    });
    if (!user || user.role !== Role.STUDENT) {
      throw new NotFoundException('Student user not found');
    }

    const data: any = {};
    if (updateStudentDto.email) data.email = updateStudentDto.email;
    if (updateStudentDto.name) data.name = updateStudentDto.name;
    if (updateStudentDto.status) data.status = updateStudentDto.status;
    if (updateStudentDto.password) {
      data.passwordHash = await bcrypt.hash(updateStudentDto.password, 10);
    }

    const studentData: any = {};
    if (updateStudentDto.batch) {
      studentData.batch = updateStudentDto.batch;
    }

    if (Object.keys(studentData).length > 0) {
      data.student = {
        update: studentData,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      include: { student: true },
    });

    // Log Activity
    if (updateStudentDto.password) {
      await this.activityService.logActivity(
        ActivityType.PASSWORD_RESET,
        `Admin reset password for student ${updatedUser.name || updatedUser.email}`,
        updatedUser.id
      );
    }
    if (updateStudentDto.batch && updateStudentDto.batch !== user.student?.batch) {
      await this.activityService.logActivity(
        ActivityType.BATCH_ASSIGNED,
        `Student ${updatedUser.name || updatedUser.email} assigned to batch ${updateStudentDto.batch}`,
        updatedUser.id
      );
    }

    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async bulkUpload(fileBuffer: Buffer) {
    const results: any[] = [];
    return new Promise((resolve, reject) => {
      Readable.from(fileBuffer)
        .pipe(csv() as any)
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          let successCount = 0;
          let failureCount = 0;
          const errors: any[] = [];

          // Process rows concurrently in chunks of 10 to speed up ingestion
          const chunkSize = 10;
          for (let i = 0; i < results.length; i += chunkSize) {
            const chunk = results.slice(i, i + chunkSize);
            await Promise.all(
              chunk.map(async (row) => {
                try {
                  if (!row.email || !row.registrationNumber || !row.batch || !row.department) {
                    throw new Error('Missing required fields');
                  }
                  await this.createStudent({
                    email: row.email,
                    name: row.name || row.email.split('@')[0],
                    password: row.password || row.registrationNumber || 'student123',
                    batch: row.batch,
                    registrationNumber: row.registrationNumber,
                    department: row.department,
                  });
                  successCount++;
                } catch (err: any) {
                  failureCount++;
                  errors.push({ row, error: err.message });
                }
              })
            );
          }

          resolve({ successCount, failureCount, errors });
        })
        .on('error', (err: any) => reject(err));
    });
  }
}

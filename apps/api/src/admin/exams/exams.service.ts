import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { ActivityService } from '../../activity/activity.service';
import { ActivityType } from '@alex/database';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async createExam(dto: CreateExamDto, adminId: string) {
    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        description: dto.description,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        durationMinutes: dto.durationMinutes,
        createdBy: adminId,
        questions: {
          create: dto.questionIds.map((id, index) => ({
            question: { connect: { id } },
            order: index + 1,
          })),
        },
        assignments: {
          create: dto.studentIds.map(id => ({
            student: { connect: { id } },
          })),
        },
      },
    });

    // Log Activity
    await this.activityService.logActivity(
      ActivityType.BATCH_ASSIGNED,
      `Exam "${exam.title}" assigned to student candidates`,
      adminId,
      { examId: exam.id }
    );

    return exam;
  }

  async getAllExams() {
    return this.prisma.exam.findMany({
      include: {
        _count: {
          select: { questions: true, assignments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExamById(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            question: {
              include: { codingQuestion: true, mcqOptions: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      }
    });

    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async getDashboardStats() {
    const totalStudents = await this.prisma.user.count({
      where: { role: 'STUDENT' },
    });

    const activeExams = await this.prisma.exam.count({
      where: { status: 'PUBLISHED' },
    });

    const completedExams = await this.prisma.examAssignment.count({
      where: { status: 'COMPLETED' },
    });

    const activeSessions = await this.prisma.session.count({
      where: { isRevoked: false, expiresAt: { gt: new Date() } },
    });

    return {
      totalStudents,
      activeExams,
      completedExams,
      activeSessions,
    };
  }

  async deleteExam(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Exam not found');

    return this.prisma.exam.delete({ where: { id } });
  }

  async exportResults(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: { question: true },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const maxScore = exam.questions.reduce((acc, q) => acc + q.question.marks, 0);

    const assignments = await this.prisma.examAssignment.findMany({
      where: { examId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        attempts: {
          orderBy: { startTime: 'desc' },
          include: {
            submissions: true,
          },
        },
      },
    });

    let csvContent = 'Student Name,Email,Registration Number,Batch,Status,Score,Max Score,Percentage,Completed At\n';

    for (const assoc of assignments) {
      const studentName = assoc.student.user.name || 'N/A';
      const email = assoc.student.user.email;
      const regNo = assoc.student.registrationNumber || 'N/A';
      const batch = assoc.student.batch;
      const status = assoc.status;

      let score = 0;
      let completedAt = 'N/A';

      const lastAttempt = assoc.attempts[0];
      if (lastAttempt) {
        score = lastAttempt.submissions.reduce((sum, s) => sum + s.scoreAwarded, 0);
        completedAt = lastAttempt.endTime ? lastAttempt.endTime.toLocaleString() : 'N/A';
      }

      const percentage = maxScore > 0 ? ((score / maxScore) * 100).toFixed(1) + '%' : '0%';

      csvContent += `"${studentName}","${email}","${regNo}","${batch}","${status}",${score},${maxScore},"${percentage}","${completedAt}"\n`;
    }

    // Log Activity
    await this.activityService.logActivity(
      ActivityType.RESULT_EXPORTED,
      `Results exported for exam: ${exam.title}`,
      exam.createdBy
    );

    return csvContent;
  }
}

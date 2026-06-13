import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCodingQuestionDto } from './dto/create-coding-question.dto';
import { CreateMCQQuestionDto } from './dto/create-mcq-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async createCodingQuestion(dto: CreateCodingQuestionDto) {
    return this.prisma.question.create({
      data: {
        type: 'CODING',
        marks: dto.marks,
        difficulty: dto.difficulty,
        tags: dto.tags,
        codingQuestion: {
          create: {
            problemStatement: dto.problemStatement,
            constraints: dto.constraints,
            sampleInput: dto.sampleInput,
            sampleOutput: dto.sampleOutput,
            testCases: {
              create: dto.testCases,
            },
          },
        },
      },
      include: {
        codingQuestion: {
          include: { testCases: true },
        },
      },
    });
  }

  /**
   * Creates an MCQ question. The prompt is stored in Question.text, which the
   * schema documents as the MCQ problem statement, so no separate table or
   * migration is required.
   */
  async createMCQQuestion(dto: CreateMCQQuestionDto) {
    return this.prisma.question.create({
      data: {
        type: 'MCQ',
        text: dto.problemStatement,
        marks: dto.marks,
        difficulty: dto.difficulty,
        tags: dto.tags,
        mcqOptions: {
          create: dto.options,
        },
      },
      include: {
        mcqOptions: true,
      },
    });
  }

  async getAllQuestions() {
    return this.prisma.question.findMany({
      include: {
        codingQuestion: true,
        mcqOptions: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteQuestion(id: string) {
    await this.prisma.question.delete({ where: { id } });
    return { message: 'Question deleted successfully' };
  }
}

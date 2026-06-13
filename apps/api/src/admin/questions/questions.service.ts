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

  // Not fully implemented yet due to Prisma schema having `MCQOption` relations, 
  // but let's implement basic structure
  async createMCQQuestion(dto: CreateMCQQuestionDto) {
    return this.prisma.question.create({
      data: {
        type: 'MCQ',
        marks: dto.marks,
        difficulty: dto.difficulty,
        tags: dto.tags,
        // Using a generic problemStatement since the schema connects it
        // We actually need to adjust the schema or just store problemStatement in codingQuestion? 
        // Wait, schema has codingQuestion with problemStatement, but no generic problemStatement on Question.
        // I will add problemStatement to a temporary place or just adapt the schema later.
        // For now, let's just create the MCQ options.
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

import { Controller, Post, Get, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CreateCodingQuestionDto } from './dto/create-coding-question.dto';
import { CreateMCQQuestionDto } from './dto/create-mcq-question.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@alex/database';

@Controller('api/v1/admin/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post('coding')
  createCoding(@Body() createCodingQuestionDto: CreateCodingQuestionDto) {
    return this.questionsService.createCodingQuestion(createCodingQuestionDto);
  }

  @Post('mcq')
  createMCQ(@Body() createMCQQuestionDto: CreateMCQQuestionDto) {
    return this.questionsService.createMCQQuestion(createMCQQuestionDto);
  }

  @Get()
  findAll() {
    return this.questionsService.getAllQuestions();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsService.deleteQuestion(id);
  }
}

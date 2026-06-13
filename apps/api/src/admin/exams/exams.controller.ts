import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, Res } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@alex/database';
import type { Response } from 'express';

@Controller('api/v1/admin/exams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@Body() createExamDto: CreateExamDto, @Req() req: any) {
    return this.examsService.createExam(createExamDto, req.user.id);
  }

  @Get()
  findAll() {
    return this.examsService.getAllExams();
  }

  @Get('stats')
  getStats() {
    return this.examsService.getDashboardStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.getExamById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examsService.deleteExam(id);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() res: Response) {
    const csvContent = await this.examsService.exportResults(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=exam_results_${id}.csv`);
    return res.status(200).send(csvContent);
  }
}

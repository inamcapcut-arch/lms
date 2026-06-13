import { Module } from '@nestjs/common';
import { StudentsController } from './students/students.controller';
import { StudentsService } from './students/students.service';
import { ExamsController } from './exams/exams.controller';
import { ExamsService } from './exams/exams.service';
import { QuestionsController } from './questions/questions.controller';
import { QuestionsService } from './questions/questions.service';

@Module({
  controllers: [StudentsController, ExamsController, QuestionsController],
  providers: [StudentsService, ExamsService, QuestionsService]
})
export class AdminModule {}

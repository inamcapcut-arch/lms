import { Module } from '@nestjs/common';
import { StudentsController } from './students/students.controller';
import { StudentsService } from './students/students.service';
import { ExamsController } from './exams/exams.controller';
import { ExamsService } from './exams/exams.service';
import { QuestionsController } from './questions/questions.controller';
import { QuestionsService } from './questions/questions.service';
import { TrainersController } from './trainers/trainers.controller';
import { TrainersService } from './trainers/trainers.service';

@Module({
  controllers: [StudentsController, ExamsController, QuestionsController, TrainersController],
  providers: [StudentsService, ExamsService, QuestionsService, TrainersService]
})
export class AdminModule {}

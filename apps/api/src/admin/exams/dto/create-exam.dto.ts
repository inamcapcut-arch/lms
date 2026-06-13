import { IsString, IsNotEmpty, IsDateString, IsNumber, IsArray } from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsNumber()
  durationMinutes: number;

  @IsArray()
  @IsString({ each: true })
  questionIds: string[];

  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}

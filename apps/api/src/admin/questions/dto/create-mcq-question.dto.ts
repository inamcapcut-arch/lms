import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class MCQOptionDto {
  @IsString()
  @IsNotEmpty()
  optionText: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateMCQQuestionDto {
  @IsString()
  @IsNotEmpty()
  problemStatement: string;

  @IsNumber()
  marks: number;

  @IsString()
  @IsNotEmpty()
  difficulty: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MCQOptionDto)
  options: MCQOptionDto[];
}

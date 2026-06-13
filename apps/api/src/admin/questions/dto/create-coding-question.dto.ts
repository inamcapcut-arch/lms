import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class TestCaseDto {
  @IsString()
  input: string;

  @IsString()
  expectedOutput: string;

  @IsBoolean()
  isHidden: boolean;

  @IsNumber()
  weightage: number;
}

export class CreateCodingQuestionDto {
  @IsString()
  @IsNotEmpty()
  problemStatement: string;

  @IsString()
  @IsNotEmpty()
  constraints: string;

  @IsString()
  @IsNotEmpty()
  sampleInput: string;

  @IsString()
  @IsNotEmpty()
  sampleOutput: string;

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
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];
}

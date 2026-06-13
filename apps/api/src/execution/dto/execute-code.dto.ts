import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class ExecuteCodeDto {
  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsBoolean()
  @IsOptional()
  isSubmit?: boolean;

  @IsString()
  @IsOptional()
  customInput?: string;
}

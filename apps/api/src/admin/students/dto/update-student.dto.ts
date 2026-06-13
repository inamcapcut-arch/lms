import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { AccountStatus } from '@alex/database';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  batch?: string;

  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @IsString()
  @IsOptional()
  password?: string;
}

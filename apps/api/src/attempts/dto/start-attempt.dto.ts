import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  examId: string;
}

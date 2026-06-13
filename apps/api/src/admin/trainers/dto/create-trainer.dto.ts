import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class CreateTrainerDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

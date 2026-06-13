import { IsString, IsNotEmpty } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  browserInfo: string;
}

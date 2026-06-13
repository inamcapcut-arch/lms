import { IsString, IsNotEmpty, IsUUID, IsObject, IsNumber } from 'class-validator';

export class SaveDraftDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  questionId: string;

  @IsObject()
  @IsNotEmpty()
  draftData: any;

  @IsNumber()
  @IsNotEmpty()
  sequenceNumber: number;

  @IsNumber()
  @IsNotEmpty()
  clientTimestamp: number;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  sessionClientId: string;
}

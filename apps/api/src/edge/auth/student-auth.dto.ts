import { IsOptional, IsString, IsUUID, IsObject, ValidateIf } from 'class-validator';

export class StudentLoginDto {
  @ValidateIf((o) => !o.examAccount)
  @IsString()
  sbd?: string;

  @ValidateIf((o) => !o.sbd)
  @IsString()
  examAccount?: string;

  @IsString()
  pin: string;

  @IsOptional()
  @IsUUID()
  examSessionId?: string;
}

export class AutosaveDto {
  @IsObject()
  answers: Record<string, unknown>;
}

export class FocusViolationDto {
  reason?: string;
}

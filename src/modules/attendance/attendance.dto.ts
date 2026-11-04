import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  DATE_PATTERN,
  MSG,
  TIME_PATTERN,
} from '../../common/dto/validation-messages.js';

export class AttendanceRowDto {
  @Type(() => Number)
  @IsInt()
  studentId: number;

  @IsIn(['출석', '지각', '결석'], { message: '출결을 골라 주세요.' })
  status: '출석' | '지각' | '결석';

  @IsOptional()
  @Matches(TIME_PATTERN, { message: '도착 시각을 골라 주세요.' })
  arrivedAt?: string;
}

export class SaveAttendanceDto {
  @IsArray({ message: '출결 목록을 보내 주세요.' })
  @ValidateNested({ each: true })
  @Type(() => AttendanceRowDto)
  rows: AttendanceRowDto[];
}

export class ExtraSessionDto {
  @Matches(DATE_PATTERN, { message: MSG.date })
  date: string;

  @Matches(TIME_PATTERN, { message: MSG.time })
  startTime: string;

  @Matches(TIME_PATTERN, { message: MSG.time })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class CancelSessionDto {
  /** 휴강을 대신할 보충 수업 (없으면 휴강만) */
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtraSessionDto)
  replacement?: ExtraSessionDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class MakeupRequestDto {
  @Type(() => Number)
  @IsInt({ message: '결석한 수업을 골라 주세요.' })
  absenceAttendanceId: number;

  @Type(() => Number)
  @IsInt({ message: '들어갈 수업을 골라 주세요.' })
  targetSessionId: number;
}

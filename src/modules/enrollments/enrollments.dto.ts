import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches } from 'class-validator';
import { DATE_PATTERN } from '../../common/dto/validation-messages.js';

export class ApplyDto {
  @Type(() => Number)
  @IsInt({ message: '자녀를 골라 주세요.' })
  studentId: number;

  @Type(() => Number)
  @IsInt({ message: '반을 골라 주세요.' })
  classId: number;
}

export class PhoneEnrollDto extends ApplyDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: '시작일을 골라 주세요.' })
  startDate?: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DATE_PATTERN,
  MSG,
  TIME_PATTERN,
} from '../../common/dto/validation-messages.js';

export class SlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @Matches(TIME_PATTERN, { message: MSG.time })
  startTime: string;

  @Matches(TIME_PATTERN, { message: MSG.time })
  endTime: string;
}

export class CreateClassDto {
  @IsString()
  @IsNotEmpty({ message: '반 이름을 적어 주세요.' })
  @MaxLength(40)
  name: string;

  @Type(() => Number)
  @IsInt({ message: '대상 학년을 골라 주세요.' })
  @Min(7)
  @Max(12)
  targetGrade: number;

  @Type(() => Number)
  @IsInt({ message: '담당 강사를 골라 주세요.' })
  teacherId: number;

  @Type(() => Number)
  @IsInt({ message: '정원은 숫자로 적어 주세요.' })
  @Min(1, { message: '정원은 1명 이상이어야 해요.' })
  capacity: number;

  @Type(() => Number)
  @IsInt({ message: '월 수강료는 숫자로 적어 주세요.' })
  @Min(0, { message: '월 수강료는 0원 이상이어야 해요.' })
  monthlyFee: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  intro?: string;

  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  @ArrayMinSize(1, { message: '정규 요일을 하나 이상 넣어 주세요.' })
  schedules: SlotDto[];

  /** 이 달 수업일도 같이 만든다 (YYYY-MM) */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: '달을 골라 주세요.' })
  generateMonth?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '정원은 숫자로 적어 주세요.' })
  @Min(1, { message: '정원은 1명 이상이어야 해요.' })
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  intro?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GenerateSessionsDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: '달을 골라 주세요.' })
  yearMonth: string;
}

export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name: string;

  @IsEmail({}, { message: MSG.email })
  email: string;

  @IsString()
  @IsNotEmpty({ message: '담당 과목을 적어 주세요.' })
  @MaxLength(40)
  subject: string;

  @Matches(DATE_PATTERN, { message: '등록일을 골라 주세요.' })
  hiredAt: string;
}

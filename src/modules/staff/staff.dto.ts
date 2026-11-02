import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DATE_PATTERN,
  MSG,
  PHONE_PATTERN,
} from '../../common/dto/validation-messages.js';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name: string;

  @IsEmail({}, { message: MSG.email })
  email: string;

  /** 관리자(원장) / 일반 직원(강사) — 공통6 */
  @IsIn(['ADMIN', 'TEACHER'], { message: '역할을 골라 주세요.' })
  role: 'ADMIN' | 'TEACHER';

  @ValidateIf((dto: CreateStaffDto) => dto.role === 'TEACHER')
  @IsString()
  @IsNotEmpty({ message: '담당 과목을 적어 주세요.' })
  subject?: string;

  @ValidateIf((dto: CreateStaffDto) => dto.role === 'TEACHER')
  @Matches(DATE_PATTERN, { message: '등록일을 골라 주세요.' })
  hiredAt?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @Matches(PHONE_PATTERN, { message: MSG.phone })
  phone?: string;
}

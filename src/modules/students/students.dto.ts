import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  NotEquals,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  DATE_PATTERN,
  MSG,
  PHONE_PATTERN,
} from '../../common/dto/validation-messages.js';

export class GuardianDto {
  @IsIn(['부', '모'], { message: '관계를 골라 주세요.' })
  relation: '부' | '모';

  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name: string;

  @Matches(PHONE_PATTERN, { message: MSG.phone })
  phone: string;

  /** 없으면 계정 없이 연락처만 저장 (결정33) */
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail({}, { message: MSG.email })
  email?: string;
}

export class RegisterStudentDto {
  @IsString()
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(40)
  name: string;

  @Matches(DATE_PATTERN, { message: '생년월일을 골라 주세요.' })
  birthDate: string;

  @Type(() => Number)
  @IsInt({ message: '학교를 골라 주세요.' })
  schoolId: number;

  @Matches(DATE_PATTERN, { message: '입학일자를 골라 주세요.' })
  enteredOn: string;

  /** 학생 로그인 이메일 (필수 — 등록 때 계정을 같이 만든다, 결정26) */
  @IsEmail({}, { message: MSG.email })
  email: string;

  /** 기존 가족에 넣으면 familyId, 새 가족이면 비우고 familyName */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  familyId?: number;

  @ValidateIf((dto: RegisterStudentDto) => !dto.familyId)
  @IsString()
  @IsNotEmpty({ message: '가족 이름을 적어 주세요. (예: 김민준 가족)' })
  familyName?: string;

  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  @ArrayMaxSize(4)
  guardians: GuardianDto[];
}

export class SchoolChangeDto {
  @Type(() => Number)
  @IsInt({ message: '학교를 골라 주세요.' })
  schoolId: number;

  @IsIn(['전학', '진학'], { message: '전학인지 진학인지 골라 주세요.' })
  changeType: '전학' | '진학';

  @Matches(DATE_PATTERN, { message: '입학일자를 골라 주세요.' })
  enteredOn: string;

  @Matches(DATE_PATTERN, { message: '바뀐 날을 골라 주세요.' })
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class GradeAdjustmentDto {
  @Type(() => Number)
  @IsInt({ message: '보정값을 골라 주세요.' })
  @NotEquals(0, { message: '보정값은 0이 아니어야 해요.' })
  delta: number;

  @IsString()
  @IsNotEmpty({ message: '사유를 적어 주세요. (예: 휴학 후 복학)' })
  @MaxLength(200)
  reason: string;

  @Matches(DATE_PATTERN, { message: '적용일을 골라 주세요.' })
  effectiveFrom: string;
}

export class CounselNoteDto {
  @IsIn(['상담', '학습', '생활', '연락', '결제', '기타'], {
    message: '종류를 골라 주세요.',
  })
  category: '상담' | '학습' | '생활' | '연락' | '결제' | '기타';

  @IsIn(['student', 'parent', 'family'])
  target: 'student' | 'parent' | 'family';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentProfileId?: number;

  @Matches(DATE_PATTERN, { message: MSG.date })
  notedOn: string;

  @IsString()
  @IsNotEmpty({ message: '내용을 적어 주세요.' })
  @MaxLength(1000)
  content: string;
}

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty({ message: '학교 이름을 적어 주세요.' })
  @MaxLength(40)
  name: string;

  @IsIn(['중', '고'], { message: '중학교인지 고등학교인지 골라 주세요.' })
  level: '중' | '고';

  @IsString()
  @IsNotEmpty({ message: '지역을 적어 주세요. (예: 서울 강남구)' })
  @MaxLength(40)
  region: string;
}

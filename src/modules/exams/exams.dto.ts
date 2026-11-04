import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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
import { DATE_PATTERN } from '../../common/dto/validation-messages.js';

export class ScoreEntryDto {
  @Type(() => Number)
  @IsInt()
  studentId: number;

  /** 비우면 미응시 — 저장하지 않는다. 빈 문자열도 미응시(0점이 아님, QA BUG-007) */
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    obj[key] === '' || obj[key] === null || obj[key] === undefined
      ? null
      : Number(obj[key]),
  )
  @IsOptional()
  @IsInt({ message: '점수는 숫자로 입력해요.' })
  @Min(0, { message: '점수는 0~100 사이로 입력해요.' })
  @Max(100, { message: '점수는 0~100 사이로 입력해요.' })
  score?: number | null;
}

export class SaveScoresDto {
  @Type(() => Number)
  @IsInt({ message: '반을 골라 주세요.' })
  classId: number;

  @IsString()
  @IsNotEmpty({ message: '시험 이름을 적어 주세요.' })
  @MaxLength(40)
  examName: string;

  @Matches(DATE_PATTERN, { message: '시험 날짜를 골라 주세요.' })
  examDate: string;

  @IsArray({ message: '점수 목록을 보내 주세요.' })
  @ValidateNested({ each: true })
  @Type(() => ScoreEntryDto)
  entries: ScoreEntryDto[];
}

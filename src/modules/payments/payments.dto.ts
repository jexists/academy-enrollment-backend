import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DATE_PATTERN, MSG } from '../../common/dto/validation-messages.js';

export class MarkPaidDto {
  @Type(() => Number)
  @IsInt()
  enrollmentId: number;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: '달을 골라 주세요.' })
  yearMonth: string;

  @IsIn(['없음', '형제', '기타'], { message: '할인 종류를 골라 주세요.' })
  discountType: '없음' | '형제' | '기타';

  @Type(() => Number)
  @IsInt({ message: '할인액은 숫자로 적어 주세요.' })
  @Min(0, { message: '할인액은 0원 이상이어야 해요.' })
  discountAmount: number;

  @Matches(DATE_PATTERN, { message: '납부일을 골라 주세요.' })
  paidAt: string;

  /** 기타 할인이면 사유 필수 (결정40) */
  @ValidateIf((dto: MarkPaidDto) => dto.discountType === '기타')
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: '기타 할인은 사유를 적어 주세요.' })
  memo?: string;
}

export class FinishDto {
  @Matches(DATE_PATTERN, { message: '그만둔 날을 골라 주세요.' })
  endDate: string;
}

export class RefundPreviewQuery {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: MSG.date })
  endDate?: string;
}

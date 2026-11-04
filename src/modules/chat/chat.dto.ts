import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '질문을 적어 주세요.' })
  @IsNotEmpty({ message: '질문을 적어 주세요.' })
  @MaxLength(500, { message: '질문은 500자까지 적을 수 있어요.' })
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[\w-]+$/, { message: '대화 번호 형식이 맞지 않아요.' })
  conversationId?: string;
}

import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MSG } from '../../common/dto/validation-messages.js';

export type AppKind = 'web' | 'admin';
const APPS: AppKind[] = ['web', 'admin'];

export class LoginDto {
  @IsEmail({}, { message: MSG.email })
  @IsNotEmpty({ message: MSG.emailRequired })
  email: string;

  @IsString({ message: MSG.passwordRequired })
  @IsNotEmpty({ message: MSG.passwordRequired })
  password: string;

  /** 어느 화면에서 로그인했나 — 코어 웹은 학부모·학생, 어드민은 원장·강사만 */
  @IsIn(APPS, { message: '로그인 화면을 다시 열어 주세요.' })
  app: AppKind;
}

export class DemoLoginDto {
  @IsEmail({}, { message: MSG.email })
  email: string;

  @IsIn(APPS, { message: '로그인 화면을 다시 열어 주세요.' })
  app: AppKind;
}

export class ChangePasswordDto {
  @IsString({ message: MSG.passwordRequired })
  @IsNotEmpty({ message: '지금 비밀번호를 적어 주세요.' })
  currentPassword: string;

  @IsString({ message: MSG.password })
  @MinLength(8, { message: MSG.password })
  @MaxLength(72, { message: MSG.passwordTooLong })
  newPassword: string;
}

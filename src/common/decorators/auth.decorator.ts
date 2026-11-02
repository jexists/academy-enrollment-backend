import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ALLOW_TEMP_PASSWORD_KEY,
  ROLES_KEY,
  type AuthUser,
  type Role,
} from '../auth.types.js';
import { AuthGuard, type AuthedRequest } from '../guards/auth.guard.js';

/** 로그인이 필요한 API. 역할을 적으면 그 역할만 쓸 수 있다. */
export const Auth = (...roles: Role[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AuthGuard));

/** 임시 비밀번호 상태에서도 부를 수 있게 한다 (내 정보, 비밀번호 변경) */
export const AllowTempPassword = () =>
  SetMetadata(ALLOW_TEMP_PASSWORD_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);

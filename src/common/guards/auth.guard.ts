import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AppUser } from '../../modules/users/app-user.entity.js';
import {
  ALLOW_TEMP_PASSWORD_KEY,
  ROLES_KEY,
  type AuthUser,
  type Role,
} from '../auth.types.js';
import { requestContext } from '../context/request-context.js';

export interface AuthedRequest extends Request {
  user: AuthUser;
}

/**
 * 로그인 토큰을 확인하고, @Auth()에 적힌 역할만 통과시킨다.
 * 토큰이 맞아도 계정을 매번 다시 본다: 사용 중지·탈퇴하면 바로 막고(공통7), 임시 비밀번호면 변경 전까지 막는다(공통8).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('로그인이 필요해요.');

    let payload: AuthUser;
    try {
      payload = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException(
        '로그인이 만료됐어요. 다시 로그인해 주세요.',
      );
    }

    const user = await this.users.findOneBy({ id: payload.id });
    if (!user)
      throw new UnauthorizedException('없는 계정이에요. 다시 로그인해 주세요.');
    if (!user.isActive)
      throw new UnauthorizedException(
        '사용이 중지된 계정이에요. 원장님께 문의하세요.',
      );

    const allowTemp = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TEMP_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.mustChangePassword && !allowTemp) {
      throw new ForbiddenException(
        '임시 비밀번호예요. 비밀번호를 바꿔야 계속할 수 있어요.',
      );
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException('볼 수 있는 권한이 없어요.');
    }

    request.user = { id: user.id, role: user.role, name: user.name };
    // 이 요청에서 저장하는 행의 created_by·updated_by와 audit_log에 쓰인다
    const store = requestContext.getStore();
    if (store) store.userId = user.id;
    return true;
  }
}

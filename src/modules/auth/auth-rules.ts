import type { Role } from '../users/app-user.entity.js';
import type { AppKind } from './auth.dto.js';

/** 코어 웹은 학부모·학생, 어드민은 원장·강사 (결정16·18·24) */
export const APP_ROLES: Record<AppKind, Role[]> = {
  web: ['PARENT', 'STUDENT'],
  admin: ['ADMIN', 'TEACHER'],
};

/** 이 계정이 이 화면에서 로그인할 수 있는지. 안 되면 안내 문구를 돌려준다 */
export function wrongAppMessage(role: Role, app: AppKind): string | null {
  if (APP_ROLES[app].includes(role)) return null;
  return app === 'admin'
    ? '학부모·학생 계정은 학원 홈페이지에서 로그인해 주세요.'
    : '직원 계정은 어드민에서 로그인해 주세요.';
}

/** 새 비밀번호 규칙 (공통2·8): 8자 이상, 지금 비밀번호와 달라야 한다 */
export function newPasswordProblem(
  current: string,
  next: string,
): string | null {
  if (next.length < 8) return '비밀번호는 8자 이상으로 적어 주세요.';
  if (current === next) return '지금 비밀번호와 다른 비밀번호로 바꿔 주세요.';
  return null;
}

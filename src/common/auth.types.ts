import type { Role } from '../modules/users/app-user.entity.js';

export type { Role };

/** 로그인 토큰에 담기는 정보 */
export interface AuthUser {
  id: number;
  role: Role;
  name: string;
}

export const ROLES_KEY = 'roles';
/** 임시 비밀번호 상태에서도 부를 수 있는 API (내 정보·비밀번호 변경) */
export const ALLOW_TEMP_PASSWORD_KEY = 'allowTempPassword';

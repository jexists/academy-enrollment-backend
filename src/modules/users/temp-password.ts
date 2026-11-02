import { randomInt } from 'node:crypto';

// 헷갈리는 글자(0·O·1·l·I)는 빼고 만든다
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** 임시 비밀번호 (예: Tmp-48Q2xk). 화면에 한 번만 보여 주고 저장은 해시로만 한다 (공통8) */
export function tempPassword(prefix = 'Tmp'): string {
  let body = '';
  for (let i = 0; i < 6; i++) body += CHARS[randomInt(CHARS.length)];
  return `${prefix}-${body}`;
}

import { newPasswordProblem, wrongAppMessage } from './auth-rules.js';

describe('wrongAppMessage — 화면별 로그인 역할', () => {
  it('학부모·학생은 코어 웹, 원장·강사는 어드민에서 로그인할 수 있다', () => {
    expect(wrongAppMessage('PARENT', 'web')).toBeNull();
    expect(wrongAppMessage('STUDENT', 'web')).toBeNull();
    expect(wrongAppMessage('ADMIN', 'admin')).toBeNull();
    expect(wrongAppMessage('TEACHER', 'admin')).toBeNull();
  });

  it('학부모가 어드민에서 로그인하면 홈페이지로 안내한다', () => {
    expect(wrongAppMessage('PARENT', 'admin')).toMatch(/학원 홈페이지/);
  });

  it('강사가 코어 웹에서 로그인하면 어드민으로 안내한다', () => {
    expect(wrongAppMessage('TEACHER', 'web')).toMatch(/어드민/);
  });
});

describe('newPasswordProblem — 새 비밀번호', () => {
  it('8자 이상이고 지금과 다르면 통과', () => {
    expect(newPasswordProblem('Tmp-48Q2xk', 'hanbit2026!')).toBeNull();
  });

  it('지금 비밀번호와 같으면 막는다', () => {
    expect(newPasswordProblem('12341234', '12341234')).toMatch(/다른 비밀번호/);
  });

  it('8자보다 짧으면 막는다', () => {
    expect(newPasswordProblem('12341234', 'short')).toMatch(/8자 이상/);
  });
});

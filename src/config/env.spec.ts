import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://user:pw@host/db',
  JWT_SECRET: 'secret',
  ADMIN_EMAIL: 'admin@hanbit.test',
  ADMIN_PASSWORD: 'pw',
};

describe('validateEnv', () => {
  it('필수 값이 있으면 기본 포트와 두 프런트 주소를 채운다', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4200);
    expect(env.FRONTEND_ORIGIN.split(',')).toEqual([
      'http://localhost:3200',
      'http://localhost:3201',
    ]);
  });

  it('필수 값이 빠지면 어떤 값인지 알려 준다', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: '' })).toThrow(
      /JWT_SECRET/,
    );
  });
});

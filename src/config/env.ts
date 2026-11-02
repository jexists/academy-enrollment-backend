export interface AppEnv {
  PORT: number;
  FRONTEND_ORIGIN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  /** 로컬 전용 데모 로그인 버튼 */
  DEMO_LOGIN: boolean;
  DEMO_PASSWORD: string;
}

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
] as const;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(
      `.env에 필수 값이 없어요: ${missing.join(', ')} (.env.example을 참고하세요)`,
    );
  }
  const text = (key: string, fallback = '') =>
    typeof raw[key] === 'string' ? raw[key] : fallback;

  return {
    PORT: Number(raw.PORT ?? 4200),
    FRONTEND_ORIGIN: text(
      'FRONTEND_ORIGIN',
      'http://localhost:3200,http://localhost:3201',
    ),
    DATABASE_URL: text('DATABASE_URL'),
    JWT_SECRET: text('JWT_SECRET'),
    ADMIN_EMAIL: text('ADMIN_EMAIL'),
    ADMIN_PASSWORD: text('ADMIN_PASSWORD'),
    DEMO_LOGIN: text('DEMO_LOGIN') === 'true',
    // 비워 두면 데모 계정도 관리자 비밀번호를 쓴다
    DEMO_PASSWORD: text('DEMO_PASSWORD') || text('ADMIN_PASSWORD'),
  };
}

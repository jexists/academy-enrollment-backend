// 여러 DTO에서 같이 쓰는 입력 규칙과 안내 문구
export const PHONE_PATTERN = /^010-?\d{4}-?\d{4}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MSG = {
  email: '이메일 형식으로 적어 주세요.',
  emailRequired: '이메일을 적어 주세요.',
  passwordRequired: '비밀번호를 적어 주세요.',
  password: '비밀번호는 8자 이상으로 적어 주세요.',
  passwordTooLong: '비밀번호는 72자까지 적을 수 있어요.',
  nameRequired: '이름을 적어 주세요.',
  phone: '휴대폰 번호는 010으로 시작하는 11자리로 적어 주세요.',
  date: '날짜를 골라 주세요.',
  time: '시간을 골라 주세요.',
} as const;

import { BadRequestException, ValidationError } from '@nestjs/common';

/** 문구를 따로 안 적은 검사(@MaxLength(40) 등)는 class-validator가 영어로 답한다 → 한국어로 (QA BUG-008) */
export function koreanConstraint(key: string, message: string): string {
  if (/[가-힣]/.test(message)) return message;
  const n = /(\d+)/.exec(message)?.[1];
  if (key === 'maxLength' && n) return `${n}자까지 적을 수 있어요.`;
  if (key === 'minLength' && n) return `${n}자 이상 적어 주세요.`;
  if (key === 'isNotEmpty') return '내용을 적어 주세요.';
  return '입력한 값을 다시 확인해 주세요.';
}

/** 중첩된 칸(예: entries.0.score)까지 펼쳐서 첫 문구만 모은다 */
function collect(errors: ValidationError[], prefix: string, out: Record<string, string>) {
  for (const error of errors) {
    const key = prefix ? `${prefix}.${error.property}` : error.property;
    const [first] = Object.entries(error.constraints ?? {});
    if (first && !out[key]) out[key] = koreanConstraint(first[0], first[1]);
    if (error.children?.length) collect(error.children, key, out);
  }
}

/** ValidationPipe 오류를 칸별 안내 문구(fieldErrors)로 바꾼다. */
export function validationExceptionFactory(errors: ValidationError[]) {
  const fieldErrors: Record<string, string> = {};
  collect(errors, '', fieldErrors);
  return new BadRequestException({
    message: '입력한 내용을 다시 확인해 주세요.',
    fieldErrors,
  });
}

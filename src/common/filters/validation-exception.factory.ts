import { BadRequestException, ValidationError } from '@nestjs/common';

/** 중첩된 칸(예: entries.0.score)까지 펼쳐서 첫 문구만 모은다 */
function collect(errors: ValidationError[], prefix: string, out: Record<string, string>) {
  for (const error of errors) {
    const key = prefix ? `${prefix}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length > 0 && !out[key]) out[key] = messages[0];
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

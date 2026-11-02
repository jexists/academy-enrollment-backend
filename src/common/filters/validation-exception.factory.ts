import { BadRequestException, ValidationError } from '@nestjs/common';

/** ValidationPipe 오류를 칸별 안내 문구(fieldErrors)로 바꾼다. */
export function validationExceptionFactory(errors: ValidationError[]) {
  const fieldErrors: Record<string, string> = {};
  for (const error of errors) {
    const messages = Object.values(error.constraints ?? {});
    if (messages.length > 0) fieldErrors[error.property] = messages[0];
  }
  return new BadRequestException({
    message: '입력한 내용을 다시 확인해 주세요.',
    fieldErrors,
  });
}

import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryFailedError } from 'typeorm';
import { SaveAttendanceDto } from '../../modules/attendance/attendance.dto.js';
import { GradeAdjustmentDto } from '../../modules/students/students.dto.js';
import { DATE_PATTERN } from '../dto/validation-messages.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

/** 필터가 보낸 응답 본문을 꺼낸다 */
function respond(exception: unknown) {
  let sent: { status?: number; body?: unknown } = {};
  const res = {
    status: (s: number) => {
      sent.status = s;
      return { json: (b: unknown) => (sent.body = b) };
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  const out = sent;
  sent = {};
  return out as { status: number; body: { message: string } };
}

describe('오류 응답 (QA BUG-001·003)', () => {
  it('형식은 맞지만 없는 날짜(DB 22008)는 500이 아니라 400', () => {
    const err = new QueryFailedError('', [], Object.assign(new Error('x'), { code: '22008' }));
    const r = respond(err);
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('날짜');
  });

  it('ParseIntPipe의 영어 문구를 한국어로', () => {
    const r = respond(new BadRequestException('Validation failed (numeric string is expected)'));
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('번호 형식이 맞지 않아요.');
  });

  it('요청 제한(429)은 한국어로', () => {
    const r = respond(new HttpException('ThrottlerException: Too Many Requests', HttpStatus.TOO_MANY_REQUESTS));
    expect(r.status).toBe(429);
    expect(r.body.message).toContain('1분 뒤');
  });

  it('모르는 오류는 그대로 500', () => {
    expect(respond(new Error('boom')).status).toBe(500);
  });
});

describe('입력 검사 (QA BUG-001·003)', () => {
  it('날짜 형식: 없는 달·일은 거절, 정상 날짜는 통과', () => {
    expect(DATE_PATTERN.test('2026-11-05')).toBe(true);
    expect(DATE_PATTERN.test('2025-13-40')).toBe(false);
    expect(DATE_PATTERN.test('2026-00-10')).toBe(false);
    expect(DATE_PATTERN.test('2026-11-32')).toBe(false);
  });

  it('학년 보정 적용일 2025-13-40은 입력 오류', () => {
    const dto = plainToInstance(GradeAdjustmentDto, { delta: 1, reason: 'QA', effectiveFrom: '2025-13-40' });
    expect(validateSync(dto).map((e) => e.property)).toContain('effectiveFrom');
  });

  it('출결 저장에 rows가 없으면 입력 오류(500이 아님)', () => {
    const dto = plainToInstance(SaveAttendanceDto, {});
    expect(validateSync(dto).map((e) => e.property)).toContain('rows');
  });
});

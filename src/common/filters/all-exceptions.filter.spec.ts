import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryFailedError } from 'typeorm';
import { SaveAttendanceDto } from '../../modules/attendance/attendance.dto.js';
import { ScoreEntryDto } from '../../modules/exams/exams.dto.js';
import { GradeAdjustmentDto } from '../../modules/students/students.dto.js';
import { DATE_PATTERN } from '../dto/validation-messages.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { koreanConstraint } from './validation-exception.factory.js';

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

  it('정수 범위를 넘는 숫자(DB 22003)도 400 (QA BUG-017)', () => {
    const err = new QueryFailedError('', [], Object.assign(new Error('x'), { code: '22003' }));
    expect(respond(err).status).toBe(400);
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

  it('성적 빈 문자열은 0점이 아니라 미응시(null) (QA BUG-007)', () => {
    const blank = plainToInstance(ScoreEntryDto, { studentId: 1, score: '' });
    expect(blank.score).toBeNull();
    expect(validateSync(blank)).toHaveLength(0);
    const zero = plainToInstance(ScoreEntryDto, { studentId: 1, score: 0 });
    expect(zero.score).toBe(0);
    const text = plainToInstance(ScoreEntryDto, { studentId: 1, score: 'abc' });
    expect(validateSync(text).length).toBeGreaterThan(0);
  });

  it('문구 없는 길이 검사도 한국어로 (QA BUG-008)', () => {
    expect(koreanConstraint('maxLength', 'name must be shorter than or equal to 40 characters')).toBe('40자까지 적을 수 있어요.');
    expect(koreanConstraint('isInt', '점수는 숫자로 입력해요.')).toBe('점수는 숫자로 입력해요.');
  });
});

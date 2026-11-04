import { describe, expect, it } from 'vitest';
import {
  CAREER_PATTERN,
  careerLines,
  normalizeBio,
  normalizeCareer,
} from './teacher-profile.js';

describe('강사 소개 규칙 (결정41)', () => {
  it('이력은 줄마다 공백·빈 줄을 정리한다', () => {
    expect(normalizeCareer('  가 \r\n\n 나  \n')).toBe('가\n나');
    expect(careerLines('가\n\n나')).toEqual(['가', '나']);
  });

  it('비어 있으면 null로 저장한다', () => {
    expect(normalizeBio('   ')).toBeNull();
    expect(normalizeCareer('\n \n')).toBeNull();
    expect(careerLines(null)).toEqual([]);
  });

  it('이력은 6줄·줄당 60자까지만 받는다', () => {
    const six = Array.from({ length: 6 }, (_, i) => `이력 ${i}`).join('\n');
    expect(CAREER_PATTERN.test(six)).toBe(true);
    expect(CAREER_PATTERN.test(`${six}\n일곱째`)).toBe(false);
    expect(CAREER_PATTERN.test('가'.repeat(60))).toBe(true);
    expect(CAREER_PATTERN.test('가'.repeat(61))).toBe(false);
  });
});

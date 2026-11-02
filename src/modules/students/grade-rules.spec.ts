import { ageOn, currentGrade, gradeLabel, schoolYear } from './grade-rules.js';

describe('학년 계산 (결정2·15)', () => {
  it('학년도는 3월에 바뀐다', () => {
    expect(schoolYear('2026-02-28')).toBe(2025);
    expect(schoolYear('2026-03-01')).toBe(2026);
  });

  it('2025년 3월 중학교 입학 → 2026년 11월에 중2', () => {
    expect(
      gradeLabel(
        currentGrade({ level: '중', enteredOn: '2025-03-02' }, '2026-11-03'),
      ),
    ).toBe('중2');
  });

  it('진급 작업 없이 3월이 되면 학년이 오른다', () => {
    const input = { level: '중' as const, enteredOn: '2025-03-02' };
    expect(currentGrade(input, '2027-02-28')).toBe(8);
    expect(currentGrade(input, '2027-03-02')).toBe(9);
  });

  it('고등학교 입학이면 고1부터 센다', () => {
    expect(
      gradeLabel(
        currentGrade({ level: '고', enteredOn: '2026-03-02' }, '2026-11-03'),
      ),
    ).toBe('고1');
  });

  it('유급 보정(−1)은 적용일부터 반영된다', () => {
    const input = {
      level: '중' as const,
      enteredOn: '2025-03-02',
      adjustments: [{ delta: -1, effectiveFrom: '2026-12-01' }],
    };
    expect(currentGrade(input, '2026-11-30')).toBe(8);
    expect(currentGrade(input, '2026-12-01')).toBe(7);
  });

  it('만 나이는 생일이 지나야 오른다', () => {
    expect(ageOn('2013-05-10', '2026-05-09')).toBe(12);
    expect(ageOn('2013-05-10', '2026-05-10')).toBe(13);
  });
});

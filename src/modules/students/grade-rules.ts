// 학년 계산 (결정2·15, erd.md "학년 계산"). 학년은 저장하지 않고 매번 계산한다.
import type { DateKey } from '../../common/time/kst.js';

/** 학년도: 3월에 시작한다. 1~2월은 전년도 학년도 */
export function schoolYear(date: DateKey): number {
  const [year, month] = date.split('-').map(Number);
  return month <= 2 ? year - 1 : year;
}

export interface GradeInput {
  /** 지금 다니는 학교의 학교급 */
  level: '중' | '고';
  /** 그 학교급에 입학한 날 */
  enteredOn: DateKey;
  /** 학년 보정 (유급 −1, 조기 진급 +1 등) */
  adjustments?: { delta: number; effectiveFrom: DateKey }[];
}

/** 7~12 = 중1~고3. 학교급 시작 학년 + (올해 학년도 − 입학 학년도) + 지금까지 적용된 보정 */
export function currentGrade(input: GradeInput, today: DateKey): number {
  const base =
    (input.level === '중' ? 7 : 10) +
    schoolYear(today) -
    schoolYear(input.enteredOn);
  const adjusted = (input.adjustments ?? [])
    .filter((a) => a.effectiveFrom <= today)
    .reduce((sum, a) => sum + a.delta, 0);
  return base + adjusted;
}

export function gradeLabel(grade: number): string {
  if (grade >= 7 && grade <= 9) return `중${grade - 6}`;
  if (grade >= 10 && grade <= 12) return `고${grade - 9}`;
  return '범위 밖';
}

/** 만 나이 */
export function ageOn(birthDate: DateKey, today: DateKey): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

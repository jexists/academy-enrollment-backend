// 출석률·보강 자격 규칙 (C13·C14·B11, 결정10·11)
import type { DateKey } from '../../common/time/kst.js';

export interface AttendanceCount {
  출석: number;
  지각: number;
  결석: number;
}

/**
 * 출석률 (C13): 지각 3번 = 결석 1번, 학생 전체·월 단위 합산 (결정10).
 * 수강 출결만 센다 — 보강 출석은 결석을 채운 것이라 따로 보여 준다.
 */
export function attendanceRate(count: AttendanceCount) {
  const total = count.출석 + count.지각 + count.결석;
  const converted = count.결석 + Math.floor(count.지각 / 3);
  return {
    total,
    convertedAbsence: converted,
    rate: total === 0 ? null : Math.round(((total - converted) / total) * 100),
  };
}

export interface MakeupCheckInput {
  absence: {
    date: DateKey;
    status: string;
    classId: number;
    targetGrade: number;
  };
  /** 결석한 달의 이 학생 결석 수 (수강 출결) */
  absencesInMonth: number;
  target: {
    date: DateKey;
    classId: number;
    targetGrade: number;
    status: string;
    capacity: number;
    /** 그날 인원 = 원래 수강생 + 확정된 보강생 */
    headcount: number;
  };
  /** 학생이 그 시간에 다른 수업이 있나 */
  studentBusy: boolean;
  today: DateKey;
}

/** 보강 신청·확정 조건 (결정11). 안 되면 쉬운 한국어 이유 */
export function makeupProblem(input: MakeupCheckInput): string | null {
  const { absence, target } = input;
  if (absence.status !== '결석')
    return '결석한 수업만 보강을 신청할 수 있어요.';
  if (input.absencesInMonth < 2)
    return '이번 달 결석이 2회 미만이라 보강을 신청할 수 없어요.';
  if (target.classId === absence.classId)
    return '다른 반 수업으로만 보강할 수 있어요.';
  if (target.targetGrade !== absence.targetGrade)
    return '같은 학년 반으로만 보강할 수 있어요.';
  if (target.date.slice(0, 7) !== absence.date.slice(0, 7))
    return '보강은 결석한 달 안에서만 잡을 수 있어요.';
  if (target.status !== '정상') return '휴강한 수업이에요.';
  if (target.date < input.today) return '이미 지난 수업이에요.';
  if (target.headcount >= target.capacity)
    return `그날 인원이 정원(${target.capacity}명)을 넘어요.`;
  if (input.studentBusy) return '그 시간에 다른 수업이 있어요.';
  return null;
}

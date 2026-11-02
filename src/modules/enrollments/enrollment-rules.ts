// 수강 신청 규칙 (B6·B7·B8, 결정5). 신청할 때와 승인할 때 둘 다 검사한다 (결정7)
import { overlaps, type Slot } from '../classes/schedule-rules.js';
import { gradeLabel } from '../students/grade-rules.js';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export type CheckCode =
  '통과' | '중복' | '운영 안 함' | '학년 불일치' | '정원 초과' | '시간 겹침';

export interface EnrollmentCheckInput {
  studentGrade: number | null;
  cls: {
    name: string;
    targetGrade: number;
    capacity: number;
    isActive: boolean;
    schedules: Slot[];
  };
  /** 지금 다니는 인원 (수강중·환불요청) */
  enrolled: number;
  /** 같은 학생이 같은 반에 진행 중인 수강이 이미 있나 */
  duplicate: boolean;
  /** 같은 학생의 다른 진행 중 수강 (신청됨·수강중·환불요청) */
  others: { className: string; schedules: Slot[] }[];
}

export interface EnrollmentCheck {
  code: CheckCode;
  message: string | null;
}

export function checkEnrollment(input: EnrollmentCheckInput): EnrollmentCheck {
  const no = (code: CheckCode, reason: string): EnrollmentCheck => ({
    code,
    message: `신청할 수 없어요. ${reason}`,
  });
  if (input.duplicate)
    return no('중복', '이미 신청했거나 다니고 있는 반이에요');
  if (!input.cls.isActive)
    return no('운영 안 함', '지금 운영하지 않는 반이에요');
  if (input.studentGrade !== input.cls.targetGrade) {
    const student =
      input.studentGrade === null
        ? '학년 확인 필요'
        : `학생은 ${gradeLabel(input.studentGrade)}`;
    return no(
      '학년 불일치',
      `${gradeLabel(input.cls.targetGrade)} 반이에요 (${student})`,
    );
  }
  if (input.enrolled >= input.cls.capacity)
    return no('정원 초과', `정원(${input.cls.capacity}명)이 찼어요`);
  for (const other of input.others) {
    for (const mine of input.cls.schedules) {
      const hit = other.schedules.find((s) => overlaps(mine, s));
      if (hit)
        return no(
          '시간 겹침',
          `시간이 겹쳐요 (${other.className} ${WEEKDAY[hit.weekday]} ${hit.startTime.slice(0, 5)})`,
        );
    }
  }
  return { code: '통과', message: null };
}

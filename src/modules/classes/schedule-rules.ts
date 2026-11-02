// 시간표 규칙: 강사 시간 겹침(B9)과 월 수업일 만들기(결정13)
import { addDays, weekdayOf, type DateKey } from '../../common/time/kst.js';

export interface Slot {
  weekday: number; // 0 = 일요일
  startTime: string; // 'HH:MM'
  endTime: string;
}

export interface NamedSlot extends Slot {
  className: string;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

const minutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/** 같은 요일이고 시간이 조금이라도 겹치면 true (끝나는 시각 = 다음 시작 시각은 안 겹침) */
export function overlaps(a: Slot, b: Slot): boolean {
  return (
    a.weekday === b.weekday &&
    minutes(a.startTime) < minutes(b.endTime) &&
    minutes(b.startTime) < minutes(a.endTime)
  );
}

/** 한 반 안에서 시간 칸이 맞는지: 끝 > 시작, 같은 요일 두 번 금지 */
export function slotProblem(slots: Slot[]): string | null {
  if (slots.length === 0) return '정규 요일을 하나 이상 넣어 주세요.';
  for (const slot of slots) {
    if (minutes(slot.endTime) <= minutes(slot.startTime))
      return '끝나는 시간이 시작 시간보다 늦어야 해요.';
  }
  const days = new Set(slots.map((s) => s.weekday));
  if (days.size !== slots.length) return '같은 요일이 두 번 들어갔어요.';
  return null;
}

/**
 * 강사가 같은 시간에 다른 반을 맡고 있으면 거절 문구 (B9).
 * 예: "저장할 수 없어요. 박강사는 화 19:00~21:00에 중2 심화A를 맡고 있어요."
 */
export function teacherConflict(
  teacherName: string,
  slots: Slot[],
  others: NamedSlot[],
): string | null {
  for (const slot of slots) {
    const hit = others.find((other) => overlaps(slot, other));
    if (hit) {
      return `저장할 수 없어요. ${teacherName}는 ${WEEKDAY[hit.weekday]} ${hit.startTime.slice(0, 5)}~${hit.endTime.slice(0, 5)}에 ${hit.className}를 맡고 있어요.`;
    }
  }
  return null;
}

/** 그 달에 정규 요일에 해당하는 날짜마다 수업 하나 (결정13: 반 → 정규 요일 → 실제 수업) */
export function monthSessions(
  slots: Slot[],
  yearMonth: string,
): { date: DateKey; startTime: string; endTime: string }[] {
  const first = `${yearMonth}-01`;
  const result: { date: DateKey; startTime: string; endTime: string }[] = [];
  for (let date = first; date.startsWith(yearMonth); date = addDays(date, 1)) {
    const slot = slots.find((s) => s.weekday === weekdayOf(date));
    if (slot)
      result.push({
        date,
        startTime: slot.startTime.slice(0, 5),
        endTime: slot.endTime.slice(0, 5),
      });
  }
  return result;
}

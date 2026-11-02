// 한국 시간(UTC+9, 서머타임 없음) 계산 도구.
// 날짜는 'YYYY-MM-DD', 시각은 하루 0시부터 지난 분(minutes)으로 다룬다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateKey = string;

export function toKstDateKey(instant: Date): DateKey {
  return new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function toKstMinutes(instant: Date): number {
  const shifted = new Date(instant.getTime() + KST_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function kstInstant(dateKey: DateKey, minutes = 0): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00+09:00`) + minutes * 60_000);
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 0 = 일요일 ... 6 = 토요일 */
export function weekdayOf(dateKey: DateKey): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

/** 그 날짜가 속한 주의 월요일 */
export function mondayOf(dateKey: DateKey): DateKey {
  const weekday = weekdayOf(dateKey);
  return addDays(dateKey, weekday === 0 ? -6 : 1 - weekday);
}

export function formatMinutes(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 'YYYY-MM-DDTHH:mm:00+09:00' 형식 (프론트와 주고받는 형식) */
export function toKstIso(instant: Date): string {
  return `${toKstDateKey(instant)}T${formatMinutes(toKstMinutes(instant))}:00+09:00`;
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

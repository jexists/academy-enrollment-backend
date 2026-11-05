// 수강료·형제 할인·환불 규칙 (B12·C15·D20, 결정9·12·40)

/** 형제 할인 (결정9): 그 달 수강 중인 형제를 등록순으로 세워 두 번째 학생부터 10% */
export const SIBLING_RATE = 0.1;

export function siblingDiscount(
  monthlyFee: number,
  siblingOrder: number,
): number {
  return siblingOrder >= 2 ? Math.round(monthlyFee * SIBLING_RATE) : 0;
}

/** 그 달 형제 순번: 수강 중인 학생만 등록순(같으면 id순)으로 세운다 */
export function siblingOrders(
  students: { id: number; registeredAt: string }[],
): Map<number, number> {
  const sorted = [...students].sort(
    (a, b) => a.registeredAt.localeCompare(b.registeredAt) || a.id - b.id,
  );
  return new Map(sorted.map((s, i) => [s.id, i + 1]));
}

export interface RefundInput {
  /** 그 달 청구액 (정가 − 할인) */
  charged: number;
  /** 그 달 실제 수업 수 (정규 중 휴강 제외 + 휴강 대체 보충) */
  totalSessions: number;
  /** 그만둔 날까지 지난 수업 수 (결석 포함) */
  passedSessions: number;
}

/**
 * 환불액 (D20, 결정12): 시작 전 전액 · 1/3 지나기 전 2/3 · 1/2 지나기 전 1/2 · 그 뒤 없음.
 * 지난 수업에는 결석도 포함하고(결석분은 보강으로 보상), 휴강은 세지 않는다.
 */
export function refundAmount(input: RefundInput) {
  const { charged, totalSessions, passedSessions } = input;
  const ratio = totalSessions === 0 ? 0 : passedSessions / totalSessions;
  let share: number;
  let rule: string;
  if (passedSessions === 0) [share, rule] = [1, '수업 시작 전 — 전액'];
  else if (ratio < 1 / 3) [share, rule] = [2 / 3, '1/3 지나기 전 — 2/3'];
  else if (ratio < 1 / 2) [share, rule] = [1 / 2, '1/2 지나기 전 — 1/2'];
  else [share, rule] = [0, '1/2 지난 뒤 — 환불 없음'];
  return {
    amount: Math.floor(charged * share),
    ratio,
    rule,
    totalSessions,
    passedSessions,
  };
}

/**
 * 수강종료 뒤 그 달 납부를 기록하면 환불액을 다시 계산해야 하나 (QA BUG-009, 결정 11-03 "환불은 그 달 낸 금액 기준").
 * 그만둔 달과 같은 달의 납부일 때만 — 다른 달 납부는 환불과 관계없다.
 */
export function refundNeedsRecalc(input: {
  status: string;
  endDate: string | null;
  paidMonth: string;
}): boolean {
  return (
    input.status === '수강종료' &&
    !!input.endDate &&
    input.endDate.slice(0, 7) === input.paidMonth
  );
}

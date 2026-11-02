import type { EntityManager } from 'typeorm';
import { addDays, todayKst } from '../../common/time/kst.js';
import { siblingDiscount, siblingOrders } from '../payments/payment-rules.js';
import { TuitionPayment } from '../payments/tuition-payment.entity.js';

/** 이번 달에 아직 안 낸 가족 (C15 미납 예시) — 김민준·김서연 형제, 박하린 */
const UNPAID_THIS_MONTH = ['김민준', '김서연', '박하린'];

/** 데모 3단계: 지난달은 모두 납부, 이번 달은 일부 미납. 형제 할인은 규칙대로 계산해서 남긴다 */
export async function seedPayments(m: EntityManager) {
  const month = todayKst().slice(0, 7);
  const lastMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const rows: {
    enrollmentId: number;
    studentId: number;
    name: string;
    familyId: number;
    registeredAt: string;
    fee: number;
    startDate: string;
  }[] = await m.query(
    `SELECT e.id AS "enrollmentId", s.id AS "studentId", s.name, s.family_id AS "familyId", to_char(s.registered_at, 'YYYY-MM-DD') AS "registeredAt",
       c.monthly_fee AS fee, to_char(e.start_date, 'YYYY-MM-DD') AS "startDate"
     FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id JOIN hw2.class c ON c.id = e.class_id
     WHERE e.status = '수강중' AND e.deleted_at IS NULL`,
  );
  for (const ym of [lastMonth, month]) {
    const active = rows.filter((r) => r.startDate <= `${ym}-31`);
    const families = new Map<number, { id: number; registeredAt: string }[]>();
    for (const r of active)
      families.set(r.familyId, [
        ...(families.get(r.familyId) ?? []),
        { id: r.studentId, registeredAt: r.registeredAt },
      ]);
    for (const r of active) {
      if (ym === month && UNPAID_THIS_MONTH.includes(r.name)) continue;
      const discount = siblingDiscount(
        r.fee,
        siblingOrders(families.get(r.familyId)!).get(r.studentId)!,
      );
      await m.save(
        m.create(TuitionPayment, {
          enrollmentId: r.enrollmentId,
          yearMonth: ym,
          listPrice: r.fee,
          discountType: discount ? '형제' : '없음',
          discountAmount: discount,
          paidAmount: r.fee - discount,
          paidAt: `${ym}-02`,
          memo: discount ? '둘째 이상 10%' : null,
        }),
      );
    }
  }
}

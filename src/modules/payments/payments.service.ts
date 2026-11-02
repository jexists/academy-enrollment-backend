import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { addDays, todayKst } from '../../common/time/kst.js';
import { Enrollment } from '../enrollments/enrollment.entity.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import {
  refundAmount,
  siblingDiscount,
  siblingOrders,
} from './payment-rules.js';
import type { MarkPaidDto } from './payments.dto.js';
import { TuitionPayment } from './tuition-payment.entity.js';

export interface BillRow {
  enrollmentId: number;
  status: string;
  studentId: number;
  studentName: string;
  familyId: number;
  familyName: string;
  classId: number;
  className: string;
  listPrice: number;
  siblingOrder: number;
  expectedDiscount: number;
  expectedCharge: number;
  payment: {
    id: number;
    discountType: string;
    discountAmount: number;
    paidAmount: number;
    paidAt: string;
    memo: string | null;
  } | null;
}

const monthEnd = (ym: string) =>
  addDays(`${addDays(`${ym}-28`, 7).slice(0, 7)}-01`, -1);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /** 그 달 청구 목록 (B12·C15): 그 달에 다닌 수강마다 정가·형제 할인·납부 여부 */
  async bills(
    yearMonth: string,
    familyId: number | null = null,
  ): Promise<BillRow[]> {
    const rows: (Omit<
      BillRow,
      'siblingOrder' | 'expectedDiscount' | 'expectedCharge'
    > & { registeredAt: string })[] = await this.dataSource.query(
      `SELECT e.id AS "enrollmentId", e.status, s.id AS "studentId", s.name AS "studentName", s.family_id AS "familyId", f.name AS "familyName",
         to_char(s.registered_at, 'YYYY-MM-DD') AS "registeredAt", c.id AS "classId", c.name AS "className", c.monthly_fee AS "listPrice",
         (SELECT json_build_object('id', p.id, 'discountType', p.discount_type, 'discountAmount', p.discount_amount, 'paidAmount', p.paid_amount,
            'paidAt', to_char(p.paid_at, 'YYYY-MM-DD'), 'memo', p.memo)
          FROM hw2.tuition_payment p WHERE p.enrollment_id = e.id AND p.year_month = $1 AND p.deleted_at IS NULL) AS payment
       FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id JOIN hw2.family f ON f.id = s.family_id JOIN hw2.class c ON c.id = e.class_id
       WHERE e.deleted_at IS NULL AND e.status IN ('수강중', '환불요청', '수강종료')
         AND e.start_date <= $3 AND (e.end_date IS NULL OR e.end_date >= $2) AND ($4::int IS NULL OR s.family_id = $4)
       ORDER BY f.name, s.registered_at, c.name`,
      [yearMonth, `${yearMonth}-01`, monthEnd(yearMonth), familyId],
    );
    // 가족마다 그 달 다니는 학생을 등록순으로 세운다
    const byFamily = new Map<number, { id: number; registeredAt: string }[]>();
    for (const r of rows) {
      const list = byFamily.get(r.familyId) ?? [];
      if (!list.some((x) => x.id === r.studentId))
        list.push({ id: r.studentId, registeredAt: r.registeredAt });
      byFamily.set(r.familyId, list);
    }
    return rows.map(({ registeredAt: _registeredAt, ...r }) => {
      const order = siblingOrders(byFamily.get(r.familyId)!).get(r.studentId)!;
      const discount = siblingDiscount(r.listPrice, order);
      return {
        ...r,
        siblingOrder: order,
        expectedDiscount: discount,
        expectedCharge: r.listPrice - discount,
      };
    });
  }

  /** 납부 체크 — 그때 정가·할인을 영수증처럼 남긴다 (결정40) */
  async markPaid(dto: MarkPaidDto) {
    const [bill] = (await this.bills(dto.yearMonth)).filter(
      (b) => b.enrollmentId === dto.enrollmentId,
    );
    if (!bill) throw new BadRequestException('그 달에 다닌 수강이 아니에요.');
    if (bill.payment)
      throw new BadRequestException('이 달 납부가 이미 기록돼 있어요.');
    if (dto.discountAmount > bill.listPrice)
      throw new BadRequestException('할인액이 정가보다 많아요.');
    const discountAmount = dto.discountType === '없음' ? 0 : dto.discountAmount;
    if (dto.discountType !== '없음' && discountAmount === 0)
      throw new BadRequestException('할인액을 적어 주세요.');
    await this.dataSource.getRepository(TuitionPayment).save({
      enrollmentId: dto.enrollmentId,
      yearMonth: dto.yearMonth,
      listPrice: bill.listPrice,
      discountType: dto.discountType,
      discountAmount,
      paidAmount: bill.listPrice - discountAmount,
      paidAt: dto.paidAt,
      memo:
        dto.memo?.trim() ||
        (dto.discountType === '형제'
          ? `둘째 이상 ${Math.round((discountAmount / bill.listPrice) * 100)}%`
          : null),
    });
    return { ok: true };
  }

  /** 환불 계산 (D20). 그만둔 날까지 그 달 실제 수업(휴강 제외, 휴강 대체 보충 포함) 중 지난 수 */
  async refundPreview(m: EntityManager, enrollmentId: number, endDate: string) {
    const enrollment = await m.findOneBy(Enrollment, { id: enrollmentId });
    if (!enrollment) throw new NotFoundException('없는 수강이에요.');
    const yearMonth = endDate.slice(0, 7);
    const [{ total, passed }] = await m.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE s.date <= $3)::int AS passed
       FROM hw2.class_session s
       WHERE s.class_id = $1 AND to_char(s.date, 'YYYY-MM') = $2 AND s.deleted_at IS NULL AND s.status = '정상'
         AND (s.kind = '정규' OR s.replaces_session_id IS NOT NULL)`,
      [enrollment.classId, yearMonth, endDate],
    );
    const [bill] = (await this.bills(yearMonth)).filter(
      (b) => b.enrollmentId === enrollmentId,
    );
    // 환불은 그 달 실제로 낸 돈 기준 (결정 11-03): 아직 안 냈으면 돌려줄 돈이 없다
    const charged = bill?.payment?.paidAmount ?? 0;
    return {
      enrollmentId,
      endDate,
      yearMonth,
      charged,
      paid: !!bill?.payment,
      ...refundAmount({
        charged,
        totalSessions: total,
        passedSessions: passed,
      }),
    };
  }

  preview(enrollmentId: number, endDate: string) {
    return this.refundPreview(this.dataSource.manager, enrollmentId, endDate);
  }

  /** 학부모: 환불 신청 → 환불요청 (결정8) */
  async requestRefund(parentUserId: number, enrollmentId: number) {
    const enrollment = await this.enrollments.ownEnrollment(
      parentUserId,
      enrollmentId,
    );
    if (enrollment.status !== '수강중')
      throw new BadRequestException('수강 중인 반만 환불 신청할 수 있어요.');
    enrollment.status = '환불요청';
    await this.dataSource.getRepository(Enrollment).save(enrollment);
    return { ok: true };
  }

  /** 관리자: 그만둔 날을 넣고 환불액을 확정 → 수강종료 (환불요청이 없어도 수강중에서 바로 가능) */
  async finish(enrollmentId: number, endDate: string, staffId: number) {
    return this.dataSource.transaction(async (m) => {
      const enrollment = await m.findOneBy(Enrollment, { id: enrollmentId });
      if (!enrollment) throw new NotFoundException('없는 수강이에요.');
      if (!['수강중', '환불요청'].includes(enrollment.status))
        throw new BadRequestException(
          `수강 중인 수강만 끝낼 수 있어요. (${enrollment.status})`,
        );
      if (endDate < enrollment.startDate)
        throw new BadRequestException('그만둔 날이 시작일보다 빨라요.');
      const preview = await this.refundPreview(m, enrollmentId, endDate);
      Object.assign(enrollment, {
        status: '수강종료',
        endDate,
        refundAmount: preview.amount,
        decidedBy: staffId,
        decidedAt: new Date(),
      });
      await m.save(enrollment);
      return preview;
    });
  }

  /** 학부모 결제 화면: 이번 달 낼 돈 · 낸 돈 · 환불 (결정19) */
  async parentPayments(parentUserId: number) {
    const familyId = await this.enrollments.familyOf(parentUserId);
    if (!familyId) return { due: [], paid: [], refunds: [], dueTotal: 0 };
    const month = todayKst().slice(0, 7);
    const current = await this.bills(month, familyId);
    const paid = await this.dataSource.query(
      `SELECT p.id, p.year_month AS "yearMonth", s.name AS "studentName", c.name AS "className", p.list_price AS "listPrice",
         p.discount_type AS "discountType", p.discount_amount AS "discountAmount", p.paid_amount AS "paidAmount", to_char(p.paid_at, 'YYYY-MM-DD') AS "paidAt", p.memo
       FROM hw2.tuition_payment p JOIN hw2.enrollment e ON e.id = p.enrollment_id JOIN hw2.student s ON s.id = e.student_id JOIN hw2.class c ON c.id = e.class_id
       WHERE s.family_id = $1 AND p.deleted_at IS NULL ORDER BY p.year_month DESC, s.registered_at`,
      [familyId],
    );
    const refundRows: {
      id: number;
      status: string;
      studentName: string;
      className: string;
      endDate: string | null;
      refundAmount: number | null;
    }[] = await this.dataSource.query(
      `SELECT e.id, e.status, s.name AS "studentName", c.name AS "className", to_char(e.end_date, 'YYYY-MM-DD') AS "endDate", e.refund_amount AS "refundAmount"
         FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id JOIN hw2.class c ON c.id = e.class_id
         WHERE s.family_id = $1 AND e.deleted_at IS NULL AND (e.status = '환불요청' OR (e.status = '수강종료' AND e.refund_amount IS NOT NULL))
         ORDER BY e.updated_at DESC`,
      [familyId],
    );
    const refunds = await Promise.all(
      refundRows.map(async (r) =>
        r.status === '환불요청'
          ? {
              ...r,
              estimate: (
                await this.refundPreview(
                  this.dataSource.manager,
                  r.id,
                  todayKst(),
                )
              ).amount,
            }
          : r,
      ),
    );
    const due = current.filter((b) => !b.payment && b.status !== '수강종료');
    return {
      month,
      due,
      paid,
      refunds,
      dueTotal: due.reduce((sum, b) => sum + b.expectedCharge, 0),
    };
  }
}

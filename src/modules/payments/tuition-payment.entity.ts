import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 월 납부 — 행이 있으면 납부, 없으면 미납 (B12). 그때 정가·할인을 영수증처럼 남긴다 (결정40) */
@Entity('tuition_payment')
export class TuitionPayment extends BaseEntity {
  @Column({ name: 'enrollment_id' })
  enrollmentId: number;

  @Column({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  @Column({ name: 'list_price' })
  listPrice: number;

  @Column({ name: 'discount_amount', default: 0 })
  discountAmount: number;

  @Column({ name: 'discount_type', type: 'varchar', default: '없음' })
  discountType: '없음' | '형제' | '기타';

  @Column({ name: 'paid_amount' })
  paidAmount: number;

  @Column({ name: 'paid_at', type: 'date' })
  paidAt: string;

  @Column({ type: 'varchar', nullable: true })
  memo: string | null;
}

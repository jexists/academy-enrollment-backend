import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type EnrollmentStatus =
  '신청됨' | '수강중' | '환불요청' | '수강종료' | '거절' | '취소';

/** 수강 기록. 그만둬도 지우지 않고 수강종료 + 그만둔 날·확정 환불액을 남긴다 (B5) */
@Entity('enrollment')
export class Enrollment extends BaseEntity {
  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'class_id' })
  classId: number;

  @Column({ type: 'varchar', default: '신청됨' })
  status: EnrollmentStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'refund_amount', type: 'int', nullable: true })
  refundAmount: number | null;

  @Column({ name: 'applied_by_parent_id', type: 'int', nullable: true })
  appliedByParentId: number | null;

  @Column({ name: 'created_by_staff_id', type: 'int', nullable: true })
  createdByStaffId: number | null;

  @Column({ name: 'decided_by', type: 'int', nullable: true })
  decidedBy: number | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type MakeupStatus = '신청' | '확정' | '거절';

/** 보강: 결석 1건 → 다른 반 수업 1개 (B11, 결정11) */
@Entity('makeup')
export class Makeup extends BaseEntity {
  @Column({ name: 'absence_attendance_id' })
  absenceAttendanceId: number;

  @Column({ name: 'target_session_id' })
  targetSessionId: number;

  @Column({ type: 'varchar', default: '신청' })
  status: MakeupStatus;

  @Column({ name: 'decided_by', type: 'int', nullable: true })
  decidedBy: number | null;
}

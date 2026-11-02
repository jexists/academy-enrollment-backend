import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type AttendanceStatus = '출석' | '지각' | '결석';

/** 출결 — 학생마다 수강·보강 구분 (B10, 결정39) */
@Entity('attendance')
export class Attendance extends BaseEntity {
  @Column({ name: 'session_id' })
  sessionId: number;

  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'attend_type', type: 'varchar', default: '수강' })
  attendType: '수강' | '보강';

  @Column({ name: 'makeup_id', type: 'int', nullable: true })
  makeupId: number | null;

  @Column({ type: 'varchar' })
  status: AttendanceStatus;

  @Column({ name: 'arrived_at', type: 'time', nullable: true })
  arrivedAt: string | null;

  @Column({ name: 'recorded_by', type: 'int', nullable: true })
  recordedBy: number | null;
}

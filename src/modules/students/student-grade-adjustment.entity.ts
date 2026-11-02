import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 유급·휴학·조기입학 같은 학년 예외 (결정15) */
@Entity('student_grade_adjustment')
export class StudentGradeAdjustment extends BaseEntity {
  @Column({ name: 'student_id' })
  studentId: number;

  @Column()
  delta: number;

  @Column()
  reason: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'staff_id' })
  staffId: number;
}

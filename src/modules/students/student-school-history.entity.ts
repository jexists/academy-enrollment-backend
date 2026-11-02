import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type SchoolChangeType = '처음등록' | '전학' | '진학';

/** 학적 이력. 학교가 바뀌면 행을 추가한다 (결정3·37) */
@Entity('student_school_history')
export class StudentSchoolHistory extends BaseEntity {
  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'school_id' })
  schoolId: number;

  @Column({ name: 'change_type', type: 'varchar' })
  changeType: SchoolChangeType;

  @Column({ name: 'entered_on', type: 'date' })
  enteredOn: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'varchar', nullable: true })
  memo: string | null;
}

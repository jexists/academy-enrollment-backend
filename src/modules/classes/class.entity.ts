import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 반. 정원은 반마다 수정할 수 있고 기본 8명 (결정1) */
@Entity('class')
export class ClassEntity extends BaseEntity {
  @Column()
  name: string;

  /** 7~12 = 중1~고3 */
  @Column({ name: 'target_grade' })
  targetGrade: number;

  @Column({ name: 'teacher_id' })
  teacherId: number;

  @Column({ default: 8 })
  capacity: number;

  @Column({ name: 'monthly_fee' })
  monthlyFee: number;

  @Column({ type: 'varchar', nullable: true })
  intro: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

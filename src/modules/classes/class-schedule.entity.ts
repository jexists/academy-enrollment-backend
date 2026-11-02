import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 반의 정규 요일 규칙 (결정13: 반 → 정규 요일 → 실제 수업 → 출결) */
@Entity('class_schedule')
export class ClassSchedule extends BaseEntity {
  @Column({ name: 'class_id' })
  classId: number;

  /** 0 = 일요일 ... 6 = 토요일 */
  @Column()
  weekday: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
}

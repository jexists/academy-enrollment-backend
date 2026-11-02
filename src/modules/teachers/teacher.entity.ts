import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 강사 정보. 계정(app_user, role TEACHER)과 1:1 */
@Entity('teacher')
export class Teacher extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  subject: string;

  @Column({ name: 'hired_at', type: 'date' })
  hiredAt: string;
}

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

  /** 소개 2~3문장 (300자). 첫 문장이 카드의 한 줄 소개 */
  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /** 이력 — 한 줄에 하나, 최대 6줄 (결정41) */
  @Column({ type: 'text', nullable: true })
  career: string | null;
}

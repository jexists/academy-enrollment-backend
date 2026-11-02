import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 학생 정보(학적). 학년·나이는 저장하지 않고 계산한다 (결정2) */
@Entity('student')
export class Student extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'family_id' })
  familyId: number;

  @Column()
  name: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: string;

  @Column({ name: 'registered_at', type: 'date' })
  registeredAt: string;
}

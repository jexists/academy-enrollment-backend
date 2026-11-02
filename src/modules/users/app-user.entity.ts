import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type Role = 'PARENT' | 'STUDENT' | 'TEACHER' | 'ADMIN';

/** 모든 계정(학부모·학생·강사·원장). 사람 정보는 profile(parent_profile·student·teacher)에 따로 */
@Entity('app_user')
export class AppUser extends BaseEntity {
  @Column()
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'varchar' })
  role: Role;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;
}

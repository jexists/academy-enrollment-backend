import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type Relation = '부' | '모';

/** 보호자 정보(보호자 연락처를 겸함). 이메일이 없으면 계정 없이 user_id null (결정33) */
@Entity('parent_profile')
export class ParentProfile extends BaseEntity {
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'family_id', type: 'int', nullable: true })
  familyId: number | null;

  @Column({ type: 'varchar' })
  relation: Relation;

  @Column()
  name: string;

  @Column()
  phone: string;
}

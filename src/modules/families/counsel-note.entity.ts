import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type CounselCategory =
  '상담' | '학습' | '생활' | '연락' | '결제' | '기타';

/** 상담·메모 한 건 (학생·학부모·가족). 내부용이라 학부모·학생에게는 보이지 않는다 (결정38) */
@Entity('counsel_note')
export class CounselNote extends BaseEntity {
  @Column({ name: 'family_id' })
  familyId: number;

  @Column({ name: 'student_id', type: 'int', nullable: true })
  studentId: number | null;

  @Column({ name: 'parent_profile_id', type: 'int', nullable: true })
  parentProfileId: number | null;

  @Column({ type: 'varchar' })
  category: CounselCategory;

  @Column({ name: 'noted_on', type: 'date' })
  notedOn: string;

  @Column({ type: 'text' })
  content: string;
}

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type SchoolLevel = '중' | '고';

/** 학교 목록. 같은 이름이 지역마다 있어서 (이름, 지역)으로 구분 (결정34) */
@Entity('school')
export class School extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar' })
  level: SchoolLevel;

  @Column()
  region: string;
}

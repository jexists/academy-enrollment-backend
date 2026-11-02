import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 형제를 묶는 가족. 보호자·학생·상담 메모가 family_id로 붙는다 */
@Entity('family')
export class Family extends BaseEntity {
  @Column()
  name: string;
}

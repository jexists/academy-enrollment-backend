import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

export type SessionStatus = '정상' | '휴강';
export type SessionKind = '정규' | '보충';

/** 실제 수업 하루. 휴강하면 status=휴강으로 남기고 보충 수업이 replaces_session_id로 가리킨다 (결정14·35) */
@Entity('class_session')
export class ClassSession extends BaseEntity {
  @Column({ name: 'class_id' })
  classId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'varchar', default: '정상' })
  status: SessionStatus;

  @Column({ type: 'varchar', default: '정규' })
  kind: SessionKind;

  @Column({ name: 'replaces_session_id', type: 'int', nullable: true })
  replacesSessionId: number | null;

  @Column({ type: 'varchar', nullable: true })
  memo: string | null;
}

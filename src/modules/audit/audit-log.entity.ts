import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction = '생성' | '수정' | '삭제' | '상태변경' | '로그인';

/** 변경 기록 (쌓기만). AuditSubscriber가 모든 저장·삭제에서 자동으로 남긴다 */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar' })
  action: AuditAction;

  @Column({ name: 'table_name' })
  tableName: string;

  @Column({ name: 'row_id', type: 'int', nullable: true })
  rowId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

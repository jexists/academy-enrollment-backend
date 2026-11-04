import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ChatSource } from './chat-sse.js';

export type ChatLogStatus = '완료' | '멈춤' | '오류';

/** 문의하기 대화 기록 (결정42, 쌓기만). 로그인했으면 user_id, 아니면 guest_id 중 하나만 */
@Entity('chat_log')
export class ChatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'guest_id', type: 'uuid', nullable: true })
  guestId: string | null;

  /** 물어본 때의 역할 (PARENT·STUDENT·TEACHER·ADMIN) */
  @Column({ type: 'varchar', nullable: true })
  role: string | null;

  @Column({ name: 'conversation_id', type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'text', default: '' })
  answer: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  sources: ChatSource[];

  @Column({ type: 'varchar' })
  status: ChatLogStatus;

  @Column({ type: 'varchar', nullable: true })
  error: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

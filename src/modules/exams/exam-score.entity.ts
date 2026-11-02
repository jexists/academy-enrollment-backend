import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

/** 시험 성적 (D16) */
@Entity('exam_score')
export class ExamScore extends BaseEntity {
  @Column({ name: 'student_id' })
  studentId: number;

  @Column({ name: 'exam_name' })
  examName: string;

  @Column({ name: 'exam_date', type: 'date' })
  examDate: string;

  @Column()
  score: number;
}

import type { EntityManager } from 'typeorm';
import { ExamScore } from '../exams/exam-score.entity.js';

/** 데모 4단계: 올해 학교 시험 성적 (D16) — 와이어프레임 예시와 같게 */
const SCORES: Record<string, [number, number, number]> = {
  김민준: [76, 81, 88],
  김서연: [82, 85, 91],
  이지호: [71, 68, 64],
  박하린: [88, 84, 90],
};
const EXAMS = [
  { name: '1학기 중간', date: '2026-04-28' },
  { name: '1학기 기말', date: '2026-07-03' },
  { name: '2학기 중간', date: '2026-10-20' },
];

export async function seedScores(m: EntityManager) {
  for (const [name, scores] of Object.entries(SCORES)) {
    const [student] = await m.query(
      `SELECT id FROM hw2.student WHERE name = $1 AND deleted_at IS NULL`,
      [name],
    );
    if (!student) continue;
    for (const [i, exam] of EXAMS.entries()) {
      await m.save(
        m.create(ExamScore, {
          studentId: student.id,
          examName: exam.name,
          examDate: exam.date,
          score: scores[i],
        }),
      );
    }
  }
}

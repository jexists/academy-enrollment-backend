import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import { ExamScore } from './exam-score.entity.js';
import type { SaveScoresDto } from './exams.dto.js';

/** 시험 성적 (D16): 강사는 담당 반 학생만 입력, 학생 상세·학생·학부모 화면에서 보기 */
@Injectable()
export class ExamsService {
  constructor(private readonly dataSource: DataSource) {}

  private async assertClass(user: AuthUser, classId: number) {
    const [row] = await this.dataSource.query(
      `SELECT t.user_id FROM hw2.class c JOIN hw2.teacher t ON t.id = c.teacher_id WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [classId],
    );
    if (!row) throw new NotFoundException('없는 반이에요.');
    if (user.role === 'TEACHER' && row.user_id !== user.id)
      throw new ForbiddenException('담당 반 학생만 입력할 수 있어요.');
  }

  /** 입력 화면: 내가 고를 수 있는 반 */
  myClasses(user: AuthUser) {
    return this.dataSource.query(
      `SELECT c.id, c.name FROM hw2.class c JOIN hw2.teacher t ON t.id = c.teacher_id
       WHERE c.is_active AND c.deleted_at IS NULL AND ($1::int IS NULL OR t.user_id = $1) ORDER BY c.target_grade, c.name`,
      [user.role === 'TEACHER' ? user.id : null],
    );
  }

  /** 반 학생 + 이 반 학생들이 본 시험 목록 + (고른 시험이면) 그 점수 */
  async sheet(
    user: AuthUser,
    classId: number,
    examName?: string,
    examDate?: string,
  ) {
    await this.assertClass(user, classId);
    const students: { studentId: number; name: string }[] =
      await this.dataSource.query(
        `SELECT s.id AS "studentId", s.name FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id
       WHERE e.class_id = $1 AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL ORDER BY s.name`,
        [classId],
      );
    const ids = students.map((s) => s.studentId);
    const exams = ids.length
      ? await this.dataSource.query(
          `SELECT exam_name AS "examName", to_char(exam_date, 'YYYY-MM-DD') AS "examDate", count(*)::int AS n
           FROM hw2.exam_score WHERE student_id = ANY($1) AND deleted_at IS NULL GROUP BY 1, 2 ORDER BY 2 DESC`,
          [ids],
        )
      : [];
    const scores: { studentId: number; score: number; id: number }[] =
      examName && examDate && ids.length
        ? await this.dataSource.query(
            `SELECT id, student_id AS "studentId", score FROM hw2.exam_score WHERE student_id = ANY($1) AND exam_name = $2 AND exam_date = $3 AND deleted_at IS NULL`,
            [ids, examName, examDate],
          )
        : [];
    return {
      students: students.map((s) => ({
        ...s,
        score: scores.find((x) => x.studentId === s.studentId)?.score ?? null,
      })),
      exams,
    };
  }

  /** 점수 저장: 같은 학생·시험·날짜면 고치고, 비운 칸은 미응시라 저장하지 않는다 */
  async save(user: AuthUser, dto: SaveScoresDto) {
    await this.assertClass(user, dto.classId);
    const { students } = await this.sheet(user, dto.classId);
    const allowed = new Set(students.map((s) => s.studentId));
    return this.dataSource.transaction(async (m) => {
      let saved = 0;
      for (const entry of dto.entries) {
        if (!allowed.has(entry.studentId))
          throw new ForbiddenException('이 반 학생이 아니에요.');
        const existing = await m.findOneBy(ExamScore, {
          studentId: entry.studentId,
          examName: dto.examName.trim(),
          examDate: dto.examDate,
        });
        if (entry.score === null || entry.score === undefined) {
          if (existing) await m.softRemove(existing);
          continue;
        }
        const row =
          existing ??
          m.create(ExamScore, {
            studentId: entry.studentId,
            examName: dto.examName.trim(),
            examDate: dto.examDate,
          });
        row.score = entry.score;
        await m.save(row);
        saved++;
      }
      return { saved };
    });
  }

  /** 학생 성적 목록 + 직전 대비 */
  async ofStudent(studentId: number) {
    const rows: {
      id: number;
      examName: string;
      examDate: string;
      score: number;
    }[] = await this.dataSource.query(
      `SELECT id, exam_name AS "examName", to_char(exam_date, 'YYYY-MM-DD') AS "examDate", score FROM hw2.exam_score
       WHERE student_id = $1 AND deleted_at IS NULL ORDER BY exam_date`,
      [studentId],
    );
    const withDiff = rows.map((r, i) => ({
      ...r,
      diff: i === 0 ? null : r.score - rows[i - 1].score,
    }));
    const average = rows.length
      ? Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 10) /
        10
      : null;
    return { scores: withDiff.reverse(), average, latest: withDiff[0] ?? null };
  }
}

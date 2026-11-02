import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull, Not } from 'typeorm';
import { ExamScore } from '../exams/exam-score.entity.js';
import { CounselNote } from '../families/counsel-note.entity.js';
import { StudentSchoolHistory } from '../students/student-school-history.entity.js';

/** 되살릴 수 있는 테이블 (잘못 지운 메모·성적·학적 이력) */
const RESTORABLE = {
  counsel_note: CounselNote,
  exam_score: ExamScore,
  student_school_history: StudentSchoolHistory,
} as const;
type Restorable = keyof typeof RESTORABLE;

/** 변경 기록·로그인 기록·삭제 항목 되살리기 (결정27·28·31) */
@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  changes(action?: string) {
    return this.dataSource.query(
      `SELECT l.id, to_char(l.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS at, COALESCE(u.name, '시스템') AS who,
         l.action, l.table_name AS "tableName", l.row_id AS "rowId", l.before, l.after, l.ip
       FROM hw2.audit_log l LEFT JOIN hw2.app_user u ON u.id = l.user_id
       WHERE ($1::text IS NULL OR l.action = $1)
       ORDER BY l.id DESC LIMIT 200`,
      [action && action !== '전체' ? action : null],
    );
  }

  logins() {
    return this.dataSource.query(
      `SELECT h.id, to_char(h.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS at, h.email, u.name, u.role, h.success, h.ip
       FROM hw2.login_history h LEFT JOIN hw2.app_user u ON u.id = h.user_id ORDER BY h.id DESC LIMIT 200`,
    );
  }

  /** 지운 항목 (되살릴 수 있는 것만) */
  async deleted() {
    const rows = await Promise.all(
      (Object.keys(RESTORABLE) as Restorable[]).map(async (table) => {
        const items = await this.dataSource
          .getRepository(RESTORABLE[table])
          .find({
            where: { deletedAt: Not(IsNull()) },
            withDeleted: true,
            take: 50,
          });
        return items.map((item) => ({
          tableName: table,
          rowId: item.id,
          deletedAt: item.deletedAt,
          data: item,
        }));
      }),
    );
    return rows
      .flat()
      .sort((a, b) => Number(b.deletedAt) - Number(a.deletedAt));
  }

  /** 되살리기 — 저장(save)이라 audit_log에 "수정"으로 남는다 */
  async restore(table: string, rowId: number) {
    if (!(table in RESTORABLE))
      throw new BadRequestException('되살릴 수 없는 항목이에요.');
    const repo = this.dataSource.getRepository(RESTORABLE[table as Restorable]);
    const item = await repo.findOne({
      where: { id: rowId },
      withDeleted: true,
    });
    if (!item) throw new NotFoundException('없는 항목이에요.');
    if (!item.deletedAt)
      throw new BadRequestException('지워지지 않은 항목이에요.');
    await repo.recover(item);
    return { ok: true };
  }

  /** 상담 메모 지우기 (soft delete) */
  async deleteNote(noteId: number) {
    const repo = this.dataSource.getRepository(CounselNote);
    const note = await repo.findOneBy({ id: noteId });
    if (!note) throw new NotFoundException('없는 메모예요.');
    await repo.softRemove(note);
    return { ok: true };
  }
}

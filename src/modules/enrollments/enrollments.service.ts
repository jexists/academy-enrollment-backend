import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { todayKst } from '../../common/time/kst.js';
import type { Slot } from '../classes/schedule-rules.js';
import { ParentProfile } from '../families/parent-profile.entity.js';
import { StudentsService } from '../students/students.service.js';
import { checkEnrollment, type EnrollmentCheck } from './enrollment-rules.js';
import { Enrollment } from './enrollment.entity.js';
import type { PhoneEnrollDto } from './enrollments.dto.js';

const ACTIVE = `('신청됨', '수강중', '환불요청')`;
const SEATED = `('수강중', '환불요청')`;
const SCHEDULES = (
  alias: string,
) => `COALESCE((SELECT json_agg(json_build_object('weekday', cs.weekday, 'startTime', to_char(cs.start_time, 'HH24:MI'), 'endTime', to_char(cs.end_time, 'HH24:MI')) ORDER BY cs.weekday)
  FROM hw2.class_schedule cs WHERE cs.class_id = ${alias}.id AND cs.deleted_at IS NULL), '[]')`;

const ENROLLMENT_SQL = `
  SELECT e.id, e.status, to_char(e.start_date, 'YYYY-MM-DD') AS "startDate", to_char(e.end_date, 'YYYY-MM-DD') AS "endDate",
    e.refund_amount AS "refundAmount", to_char(e.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS "appliedOn",
    e.created_by_staff_id IS NOT NULL AS "byPhone",
    s.id AS "studentId", s.name AS "studentName", s.family_id AS "familyId",
    c.id AS "classId", c.name AS "className", c.monthly_fee AS "monthlyFee", c.capacity, ${SCHEDULES('c')} AS schedules,
    (SELECT count(*) FROM hw2.enrollment x WHERE x.class_id = c.id AND x.status IN ${SEATED} AND x.deleted_at IS NULL)::int AS enrolled
  FROM hw2.enrollment e
  JOIN hw2.student s ON s.id = e.student_id
  JOIN hw2.class c ON c.id = e.class_id
  WHERE e.deleted_at IS NULL`;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly students: StudentsService,
  ) {}

  /** 규칙 검사에 필요한 값을 모아 checkEnrollment에 넘긴다. exceptId = 승인하는 그 신청 */
  async check(
    m: EntityManager,
    studentId: number,
    classId: number,
    exceptId: number | null = null,
  ): Promise<EnrollmentCheck> {
    const [cls] = await m.query(
      `SELECT c.name, c.target_grade AS "targetGrade", c.capacity, c.is_active AS "isActive", ${SCHEDULES('c')} AS schedules,
         (SELECT count(*) FROM hw2.enrollment x WHERE x.class_id = c.id AND x.status IN ${SEATED} AND x.deleted_at IS NULL AND ($2::int IS NULL OR x.id <> $2))::int AS enrolled
       FROM hw2.class c WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [classId, exceptId],
    );
    if (!cls) throw new NotFoundException('없는 반이에요.');
    const others: { classId: number; className: string; schedules: Slot[] }[] =
      await m.query(
        `SELECT c.id AS "classId", c.name AS "className", ${SCHEDULES('c')} AS schedules
       FROM hw2.enrollment e JOIN hw2.class c ON c.id = e.class_id
       WHERE e.student_id = $1 AND e.status IN ${ACTIVE} AND e.deleted_at IS NULL AND ($2::int IS NULL OR e.id <> $2)`,
        [studentId, exceptId],
      );
    return checkEnrollment({
      studentGrade: await this.students.gradeOf(studentId),
      cls,
      enrolled: cls.enrolled,
      duplicate: others.some((o) => o.classId === classId),
      others: others.filter((o) => o.classId !== classId),
    });
  }

  // ───────── 학부모 ─────────

  /** 이 학부모 가족의 자녀들. 아직 가족에 연결 전이면 빈 목록 */
  async children(parentUserId: number) {
    const familyId = await this.familyOf(parentUserId);
    if (!familyId) return [];
    const list = await this.students.list();
    return list.filter((s) => s.familyId === familyId);
  }

  /** 자녀 학년에 맞는 반 목록 + 신청 가능 여부(안 되면 이유) — 화면에서 비활성 + 이유로 보여 준다 */
  async classesFor(parentUserId: number, studentId: number) {
    await this.assertChild(parentUserId, studentId);
    const grade = await this.students.gradeOf(studentId);
    const classes: {
      id: number;
      name: string;
      targetGrade: number;
      teacherName: string;
      monthlyFee: number;
      capacity: number;
      enrolled: number;
      schedules: Slot[];
    }[] = await this.dataSource.query(
      `SELECT c.id, c.name, c.target_grade AS "targetGrade", u.name AS "teacherName", c.monthly_fee AS "monthlyFee", c.capacity, ${SCHEDULES('c')} AS schedules,
           (SELECT count(*) FROM hw2.enrollment x WHERE x.class_id = c.id AND x.status IN ${SEATED} AND x.deleted_at IS NULL)::int AS enrolled
         FROM hw2.class c JOIN hw2.teacher t ON t.id = c.teacher_id JOIN hw2.app_user u ON u.id = t.user_id
         WHERE c.is_active AND c.deleted_at IS NULL AND c.target_grade = $1 ORDER BY c.name`,
      [grade],
    );
    const mine: { classId: number; status: string }[] =
      await this.dataSource.query(
        `SELECT class_id AS "classId", status FROM hw2.enrollment WHERE student_id = $1 AND status IN ${ACTIVE} AND deleted_at IS NULL`,
        [studentId],
      );
    return Promise.all(
      classes.map(async (cls) => {
        const own = mine.find((x) => x.classId === cls.id);
        const result = own
          ? null
          : await this.check(this.dataSource.manager, studentId, cls.id);
        return { ...cls, myStatus: own?.status ?? null, check: result };
      }),
    );
  }

  async apply(parentUserId: number, studentId: number, classId: number) {
    await this.assertChild(parentUserId, studentId);
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT id FROM hw2.class WHERE id = $1 FOR UPDATE`, [
        classId,
      ]);
      const result = await this.check(m, studentId, classId);
      if (result.message) throw new BadRequestException(result.message);
      const profile = await m.findOneByOrFail(ParentProfile, {
        userId: parentUserId,
      });
      const saved = await m.save(
        m.create(Enrollment, {
          studentId,
          classId,
          status: '신청됨',
          startDate: todayKst(),
          appliedByParentId: profile.id,
        }),
      );
      return { id: saved.id };
    });
  }

  /** 신청 취소: 승인 전(신청됨)만 (결정8) */
  async cancel(parentUserId: number, enrollmentId: number) {
    const enrollment = await this.ownEnrollment(parentUserId, enrollmentId);
    if (enrollment.status !== '신청됨') {
      throw new BadRequestException(
        '승인 전 신청만 취소할 수 있어요. 수강 중이면 환불 신청을 해 주세요.',
      );
    }
    return this.dataSource.transaction(async (m) => {
      const locked = await m.findOne(Enrollment, {
        where: { id: enrollment.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked?.status !== '신청됨')
        throw new BadRequestException(
          '승인 전 신청만 취소할 수 있어요. 수강 중이면 환불 신청을 해 주세요.',
        );
      locked.status = '취소';
      await m.save(locked);
      return { ok: true };
    });
  }

  async parentEnrollments(parentUserId: number) {
    const familyId = await this.familyOf(parentUserId);
    if (!familyId) return [];
    return this.dataSource.query(
      `${ENROLLMENT_SQL} AND s.family_id = $1 ORDER BY s.registered_at, e.created_at DESC`,
      [familyId],
    );
  }

  // ───────── 관리자 ─────────

  /** 신청 내역. 신청됨은 지금 기준으로 규칙을 다시 검사해서 결과를 붙인다 */
  async adminList(status?: string) {
    const params: unknown[] = [];
    let sql = ENROLLMENT_SQL;
    if (status && status !== '전체') {
      params.push(status);
      sql += ` AND e.status = $1`;
    }
    const rows: {
      id: number;
      status: string;
      studentId: number;
      classId: number;
    }[] = await this.dataSource.query(
      `${sql} ORDER BY e.created_at DESC LIMIT 200`,
      params,
    );
    return Promise.all(
      rows.map(async (row) =>
        row.status === '신청됨'
          ? {
              ...row,
              check: await this.check(
                this.dataSource.manager,
                row.studentId,
                row.classId,
                row.id,
              ),
            }
          : row,
      ),
    );
  }

  /** 승인: 규칙을 한 번 더 검사하고 수강중으로 (결정7). 같은 반 동시 승인은 반 행을 잠가 정원을 지킨다 */
  async approve(id: number, staffId: number) {
    return this.dataSource.transaction(async (m) => {
      const enrollment = await this.lockPending(m, id);
      await m.query(`SELECT id FROM hw2.class WHERE id = $1 FOR UPDATE`, [
        enrollment.classId,
      ]);
      const result = await this.check(
        m,
        enrollment.studentId,
        enrollment.classId,
        enrollment.id,
      );
      if (result.message)
        throw new BadRequestException(
          result.message.replace('신청할 수 없어요', '승인할 수 없어요'),
        );
      Object.assign(enrollment, {
        status: '수강중',
        startDate: todayKst(),
        decidedBy: staffId,
        decidedAt: new Date(),
      });
      await m.save(enrollment);
      return { ok: true };
    });
  }

  async reject(id: number, staffId: number) {
    return this.dataSource.transaction(async (m) => {
      const enrollment = await this.lockPending(m, id);
      Object.assign(enrollment, {
        status: '거절',
        decidedBy: staffId,
        decidedAt: new Date(),
      });
      await m.save(enrollment);
      return { ok: true };
    });
  }

  /** 신청 행을 잠그고 아직 신청됨인지 본다 — 승인·거절·취소가 동시에 와도 한 번만 처리 (QA BUG-006) */
  private async lockPending(m: EntityManager, id: number) {
    const enrollment = await m.findOne(Enrollment, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!enrollment) throw new NotFoundException('없는 신청이에요.');
    if (enrollment.status !== '신청됨')
      throw new BadRequestException(
        `이미 처리된 신청이에요. (${enrollment.status})`,
      );
    return enrollment;
  }

  /** 전화 신청 대신 등록: 같은 규칙 검사 후 바로 수강중 (결정20) */
  async phone(staffId: number, dto: PhoneEnrollDto) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT id FROM hw2.class WHERE id = $1 FOR UPDATE`, [
        dto.classId,
      ]);
      const result = await this.check(m, dto.studentId, dto.classId);
      if (result.message)
        throw new BadRequestException(
          result.message.replace('신청할 수 없어요', '등록할 수 없어요'),
        );
      const saved = await m.save(
        m.create(Enrollment, {
          studentId: dto.studentId,
          classId: dto.classId,
          status: '수강중',
          startDate: dto.startDate ?? todayKst(),
          createdByStaffId: staffId,
          decidedBy: staffId,
          decidedAt: new Date(),
        }),
      );
      return { id: saved.id };
    });
  }

  // ───────── 소유 확인 ─────────

  async familyOf(parentUserId: number): Promise<number | null> {
    const profile = await this.dataSource
      .getRepository(ParentProfile)
      .findOneBy({ userId: parentUserId });
    return profile?.familyId ?? null;
  }

  /** 학부모는 자기 가족 자녀만 (공통4) */
  async assertChild(parentUserId: number, studentId: number) {
    const familyId = await this.familyOf(parentUserId);
    const [row] = await this.dataSource.query(
      `SELECT family_id FROM hw2.student WHERE id = $1 AND deleted_at IS NULL`,
      [studentId],
    );
    if (!familyId || !row || row.family_id !== familyId)
      throw new ForbiddenException('우리 가족 자녀만 볼 수 있어요.');
  }

  async ownEnrollment(parentUserId: number, enrollmentId: number) {
    const enrollment = await this.dataSource
      .getRepository(Enrollment)
      .findOneBy({ id: enrollmentId });
    if (!enrollment) throw new NotFoundException('없는 수강이에요.');
    await this.assertChild(parentUserId, enrollment.studentId);
    return enrollment;
  }
}

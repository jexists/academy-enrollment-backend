import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Teacher } from '../teachers/teacher.entity.js';
import { normalizeBio, normalizeCareer } from '../teachers/teacher-profile.js';
import { AccountsService } from '../users/accounts.service.js';
import { ClassSchedule } from './class-schedule.entity.js';
import { ClassSession } from './class-session.entity.js';
import { ClassEntity } from './class.entity.js';
import type {
  CreateClassDto,
  CreateTeacherDto,
  UpdateClassDto,
  UpdateTeacherProfileDto,
} from './classes.dto.js';
import {
  monthSessions,
  slotProblem,
  teacherConflict,
  type NamedSlot,
  type Slot,
} from './schedule-rules.js';
import { todayKst } from '../../common/time/kst.js';

const CLASS_SQL = `
  SELECT c.id, c.name, c.target_grade AS "targetGrade", c.capacity, c.monthly_fee AS "monthlyFee", c.intro,
    c.is_active AS "isActive", c.teacher_id AS "teacherId", u.name AS "teacherName",
    (SELECT count(*) FROM hw2.enrollment e WHERE e.class_id = c.id AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL)::int AS enrolled,
    COALESCE((SELECT json_agg(json_build_object('weekday', s.weekday, 'startTime', to_char(s.start_time, 'HH24:MI'), 'endTime', to_char(s.end_time, 'HH24:MI')) ORDER BY s.weekday)
      FROM hw2.class_schedule s WHERE s.class_id = c.id AND s.deleted_at IS NULL), '[]') AS schedules
  FROM hw2.class c
  JOIN hw2.teacher t ON t.id = c.teacher_id
  JOIN hw2.app_user u ON u.id = t.user_id
  WHERE c.deleted_at IS NULL`;

@Injectable()
export class ClassesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accounts: AccountsService,
  ) {}

  list() {
    return this.dataSource.query(
      `${CLASS_SQL} ORDER BY c.is_active DESC, c.target_grade, c.name`,
    );
  }

  async detail(id: number, yearMonth: string) {
    const [cls] = await this.dataSource.query(`${CLASS_SQL} AND c.id = $1`, [
      id,
    ]);
    if (!cls) throw new NotFoundException('없는 반이에요.');
    const sessions = await this.dataSource.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime",
         to_char(s.end_time, 'HH24:MI') AS "endTime", s.status, s.kind, s.replaces_session_id AS "replacesSessionId", s.memo
       FROM hw2.class_session s
       WHERE s.class_id = $1 AND to_char(s.date, 'YYYY-MM') = $2 AND s.deleted_at IS NULL
       ORDER BY s.date, s.start_time`,
      [id, yearMonth],
    );
    return { ...cls, yearMonth, sessions };
  }

  /** 수업 시간표 생성: 반 + 정규 요일 (+ 그 달 수업일). 강사 시간 겹침이면 거절 (A4·B9) */
  async create(dto: CreateClassDto) {
    const problem = slotProblem(dto.schedules);
    if (problem) throw new BadRequestException(problem);
    return this.dataSource.transaction(async (m) => {
      const teacher = await m.findOneBy(Teacher, { id: dto.teacherId });
      if (!teacher)
        throw new BadRequestException('없는 강사예요. 다시 골라 주세요.');
      await this.assertTeacherFree(m, teacher, dto.schedules, null);

      const cls = await m.save(
        m.create(ClassEntity, {
          name: dto.name.trim(),
          targetGrade: dto.targetGrade,
          teacherId: teacher.id,
          capacity: dto.capacity,
          monthlyFee: dto.monthlyFee,
          intro: dto.intro?.trim() || null,
        }),
      );
      for (const slot of dto.schedules) {
        await m.save(m.create(ClassSchedule, { classId: cls.id, ...slot }));
      }
      const created = dto.generateMonth
        ? await this.generate(m, cls.id, dto.schedules, dto.generateMonth)
        : 0;
      return { id: cls.id, sessionsCreated: created };
    });
  }

  /** 정원·수강료·소개·운영 여부 수정 (결정1: 정원은 반마다 수정) */
  async update(id: number, dto: UpdateClassDto) {
    const repo = this.dataSource.getRepository(ClassEntity);
    const cls = await repo.findOneBy({ id });
    if (!cls) throw new NotFoundException('없는 반이에요.');
    if (dto.capacity !== undefined) {
      const [{ enrolled }] = await this.dataSource.query(
        `SELECT count(*)::int AS enrolled FROM hw2.enrollment WHERE class_id = $1 AND status IN ('수강중', '환불요청') AND deleted_at IS NULL`,
        [id],
      );
      if (dto.capacity < enrolled) {
        throw new BadRequestException(
          `정원을 줄일 수 없어요. 지금 ${enrolled}명이 다니고 있어요.`,
        );
      }
    }
    Object.assign(cls, {
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.monthlyFee !== undefined && { monthlyFee: dto.monthlyFee }),
      ...(dto.intro !== undefined && { intro: dto.intro.trim() || null }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    await repo.save(cls);
    // 한국 시간 기준 이번 달 (UTC로 자르면 매달 1일 0~9시에 지난달이 됨)
    return this.detail(id, todayKst().slice(0, 7));
  }

  /** 그 달 수업일 만들기. 이미 있는 날짜는 건너뛴다 */
  async generateMonth(id: number, yearMonth: string) {
    return this.dataSource.transaction(async (m) => {
      const schedules = await m.findBy(ClassSchedule, { classId: id });
      if (schedules.length === 0)
        throw new BadRequestException('정규 요일이 없는 반이에요.');
      return { created: await this.generate(m, id, schedules, yearMonth) };
    });
  }

  private async generate(
    m: EntityManager,
    classId: number,
    slots: Slot[],
    yearMonth: string,
  ) {
    const existing = new Set(
      (
        await m.query(
          `SELECT to_char(date, 'YYYY-MM-DD') || ' ' || to_char(start_time, 'HH24:MI') AS k FROM hw2.class_session
           WHERE class_id = $1 AND to_char(date, 'YYYY-MM') = $2 AND deleted_at IS NULL`,
          [classId, yearMonth],
        )
      ).map((row: { k: string }) => row.k),
    );
    let created = 0;
    for (const s of monthSessions(slots, yearMonth)) {
      if (existing.has(`${s.date} ${s.startTime}`)) continue;
      await m.save(m.create(ClassSession, { classId, ...s }));
      created++;
    }
    return created;
  }

  /** 이 강사가 맡은 다른 반의 정규 시간과 겹치는지 (B9) */
  private async assertTeacherFree(
    m: EntityManager,
    teacher: Teacher,
    slots: Slot[],
    exceptClassId: number | null,
  ) {
    const others: NamedSlot[] = await m.query(
      `SELECT s.weekday, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime", c.name AS "className"
       FROM hw2.class_schedule s JOIN hw2.class c ON c.id = s.class_id
       WHERE c.teacher_id = $1 AND c.is_active AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND ($2::int IS NULL OR c.id <> $2)`,
      [teacher.id, exceptClassId],
    );
    const [{ name }] = await m.query(
      `SELECT name FROM hw2.app_user WHERE id = $1`,
      [teacher.userId],
    );
    const conflict = teacherConflict(name, slots, others);
    if (conflict) throw new ConflictException(conflict);
  }

  /** 강사가 맡은 반들의 정규 시간 (시간표 생성 화면 미리보기) */
  teacherSlots(teacherId: number) {
    return this.dataSource.query(
      `SELECT s.weekday, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime", c.id AS "classId", c.name AS "className"
       FROM hw2.class_schedule s JOIN hw2.class c ON c.id = s.class_id
       WHERE c.teacher_id = $1 AND c.is_active AND c.deleted_at IS NULL AND s.deleted_at IS NULL
       ORDER BY s.weekday, s.start_time`,
      [teacherId],
    );
  }

  teachers() {
    return this.dataSource.query(
      `SELECT t.id, u.id AS "userId", u.name, u.email, u.is_active AS "isActive", u.must_change_password AS "mustChangePassword",
         t.subject, to_char(t.hired_at, 'YYYY-MM-DD') AS "hiredAt", t.bio, t.career,
         COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.target_grade)
           FROM hw2.class c WHERE c.teacher_id = t.id AND c.is_active AND c.deleted_at IS NULL), '[]') AS classes
       FROM hw2.teacher t JOIN hw2.app_user u ON u.id = t.user_id
       WHERE t.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY u.is_active DESC, t.hired_at`,
    );
  }

  /** 강사 추가: 직원 계정(TEACHER, 임시 비밀번호) + 강사 정보를 같이 만든다 (결정22) */
  async createTeacher(dto: CreateTeacherDto) {
    return this.dataSource.transaction(async (m) => {
      const account = await this.accounts.create(
        m,
        dto.email,
        dto.name.trim(),
        'TEACHER',
      );
      const teacher = await m.save(
        m.create(Teacher, {
          userId: account.user.id,
          subject: dto.subject.trim(),
          hiredAt: dto.hiredAt,
          bio: normalizeBio(dto.bio),
          career: normalizeCareer(dto.career),
        }),
      );
      return {
        id: teacher.id,
        issued: {
          name: dto.name,
          email: account.user.email,
          password: account.password,
        },
      };
    });
  }

  /** 강사 소개·이력 고치기 (결정41). 공개 강사진 화면에 바로 보인다 */
  async updateTeacherProfile(id: number, dto: UpdateTeacherProfileDto) {
    const repo = this.dataSource.getRepository(Teacher);
    const teacher = await repo.findOneBy({ id });
    if (!teacher) throw new NotFoundException('없는 강사예요.');
    if (dto.bio !== undefined) teacher.bio = normalizeBio(dto.bio);
    if (dto.career !== undefined) teacher.career = normalizeCareer(dto.career);
    await repo.save(teacher);
    return { ok: true };
  }
}

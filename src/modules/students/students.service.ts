import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { todayKst } from '../../common/time/kst.js';
import { CounselNote } from '../families/counsel-note.entity.js';
import { Family } from '../families/family.entity.js';
import { ParentProfile } from '../families/parent-profile.entity.js';
import { AccountsService } from '../users/accounts.service.js';
import { AppUser } from '../users/app-user.entity.js';
import { ageOn, currentGrade, gradeLabel } from './grade-rules.js';
import { School } from './school.entity.js';
import { StudentGradeAdjustment } from './student-grade-adjustment.entity.js';
import { StudentSchoolHistory } from './student-school-history.entity.js';
import { Student } from './student.entity.js';
import type {
  CounselNoteDto,
  CreateSchoolDto,
  GradeAdjustmentDto,
  GuardianDto,
  RegisterStudentDto,
  SchoolChangeDto,
} from './students.dto.js';

interface StudentRow {
  id: number;
  name: string;
  birth_date: string;
  registered_at: string;
  family_id: number;
  family_name: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  school_name: string | null;
  level: '중' | '고' | null;
  region: string | null;
  entered_on: string | null;
  adjustments: { delta: number; effectiveFrom: string }[];
  sibling_order: number;
}

export interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

const STUDENT_SQL = `
  SELECT s.id, s.name, to_char(s.birth_date, 'YYYY-MM-DD') AS birth_date, to_char(s.registered_at, 'YYYY-MM-DD') AS registered_at,
    s.family_id, f.name AS family_name, u.email, u.is_active, u.must_change_password,
    cs.school_name, cs.level, cs.region, to_char(cs.entered_on, 'YYYY-MM-DD') AS entered_on,
    COALESCE((SELECT json_agg(json_build_object('delta', a.delta, 'effectiveFrom', to_char(a.effective_from, 'YYYY-MM-DD')))
      FROM hw2.student_grade_adjustment a WHERE a.student_id = s.id AND a.deleted_at IS NULL), '[]') AS adjustments,
    (SELECT count(*) FROM hw2.student s2 WHERE s2.family_id = s.family_id AND s2.deleted_at IS NULL
      AND (s2.registered_at, s2.id) <= (s.registered_at, s.id))::int AS sibling_order
  FROM hw2.student s
  JOIN hw2.family f ON f.id = s.family_id
  JOIN hw2.app_user u ON u.id = s.user_id
  LEFT JOIN hw2.student_current_school cs ON cs.student_id = s.id
  WHERE s.deleted_at IS NULL`;

@Injectable()
export class StudentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accounts: AccountsService,
  ) {}

  /** 학생 목록 — 학년·나이는 계산값 */
  async list(q?: string) {
    const params: unknown[] = [];
    let sql = STUDENT_SQL;
    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      sql += ` AND (s.name ILIKE $1 OR f.name ILIKE $1 OR u.email ILIKE $1)`;
    }
    const rows: StudentRow[] = await this.dataSource.query(
      `${sql} ORDER BY s.name`,
      params,
    );
    return rows.map((row) => this.toView(row));
  }

  /** 학생 지금 학년 (7~12). 학교 이력이 없으면 null */
  async gradeOf(id: number): Promise<number | null> {
    const [row]: StudentRow[] = await this.dataSource.query(
      `${STUDENT_SQL} AND s.id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('없는 학생이에요.');
    return this.toView(row).grade;
  }

  async detail(id: number) {
    const [row]: StudentRow[] = await this.dataSource.query(
      `${STUDENT_SQL} AND s.id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('없는 학생이에요.');
    const [history, adjustments, guardians, notes, siblings] =
      await Promise.all([
        this.dataSource.query(
          `SELECT h.id, h.change_type AS "changeType", to_char(h.entered_on, 'YYYY-MM-DD') AS "enteredOn",
           to_char(h.effective_from, 'YYYY-MM-DD') AS "effectiveFrom", h.memo, sc.name AS "schoolName", sc.level, sc.region
         FROM hw2.student_school_history h JOIN hw2.school sc ON sc.id = h.school_id
         WHERE h.student_id = $1 AND h.deleted_at IS NULL ORDER BY h.effective_from DESC, h.id DESC`,
          [id],
        ),
        this.dataSource.query(
          `SELECT a.id, a.delta, a.reason, to_char(a.effective_from, 'YYYY-MM-DD') AS "effectiveFrom", u.name AS "staffName"
         FROM hw2.student_grade_adjustment a JOIN hw2.app_user u ON u.id = a.staff_id
         WHERE a.student_id = $1 AND a.deleted_at IS NULL ORDER BY a.effective_from DESC`,
          [id],
        ),
        this.dataSource.query(
          `SELECT p.id, p.relation, p.name, p.phone, u.email, u.is_active AS "isActive"
         FROM hw2.parent_profile p LEFT JOIN hw2.app_user u ON u.id = p.user_id AND u.deleted_at IS NULL
         WHERE p.family_id = $1 AND p.deleted_at IS NULL ORDER BY p.id`,
          [row.family_id],
        ),
        this.dataSource.query(
          `SELECT n.id, n.category, to_char(n.noted_on, 'YYYY-MM-DD') AS "notedOn", n.content,
           CASE WHEN n.student_id IS NOT NULL THEN s.name WHEN n.parent_profile_id IS NOT NULL THEN p.name || '(' || p.relation || ')' ELSE '가족' END AS target,
           u.name AS "authorName"
         FROM hw2.counsel_note n
         LEFT JOIN hw2.student s ON s.id = n.student_id
         LEFT JOIN hw2.parent_profile p ON p.id = n.parent_profile_id
         LEFT JOIN hw2.app_user u ON u.id = n.created_by
         WHERE n.family_id = $1 AND n.deleted_at IS NULL AND (n.student_id IS NULL OR n.student_id = $2)
         ORDER BY n.noted_on DESC, n.id DESC`,
          [row.family_id, id],
        ),
        this.dataSource.query(
          `SELECT s.id, s.name FROM hw2.student s WHERE s.family_id = $1 AND s.id <> $2 AND s.deleted_at IS NULL ORDER BY s.registered_at`,
          [row.family_id, id],
        ),
      ]);
    const enrollments = await this.dataSource.query(
      `SELECT e.id, e.status, c.name AS "className", u.name AS "teacherName", to_char(e.start_date, 'YYYY-MM-DD') AS "startDate",
         to_char(e.end_date, 'YYYY-MM-DD') AS "endDate", e.refund_amount AS "refundAmount"
       FROM hw2.enrollment e JOIN hw2.class c ON c.id = e.class_id JOIN hw2.teacher t ON t.id = c.teacher_id JOIN hw2.app_user u ON u.id = t.user_id
       WHERE e.student_id = $1 AND e.deleted_at IS NULL ORDER BY e.created_at DESC`,
      [id],
    );
    return {
      ...this.toView(row),
      history,
      adjustments,
      guardians,
      notes,
      siblings,
      enrollments,
    };
  }

  /**
   * 학생 등록 (결정6·26·33): 학생 계정 + 가족(새로/기존) + 보호자.
   * 보호자 이메일이 이미 가입한 학부모 계정이면 새로 만들지 않고 이 가족에 연결한다.
   * 한 트랜잭션 — 중간에 실패하면 아무것도 남지 않는다.
   */
  async register(dto: RegisterStudentDto) {
    return this.dataSource.transaction(async (m) => {
      const school = await m.findOneBy(School, { id: dto.schoolId });
      if (!school)
        throw new BadRequestException(
          '없는 학교예요. 학교를 다시 골라 주세요.',
        );

      let family: Family;
      if (dto.familyId) {
        const found = await m.findOneBy(Family, { id: dto.familyId });
        if (!found)
          throw new BadRequestException('없는 가족이에요. 다시 골라 주세요.');
        family = found;
      } else {
        if (dto.guardians.length === 0) {
          throw new BadRequestException(
            '새 가족이면 보호자를 한 명 이상 적어 주세요.',
          );
        }
        family = await m.save(
          m.create(Family, { name: dto.familyName!.trim() }),
        );
      }

      const issued: IssuedPassword[] = [];
      const studentAccount = await this.accounts.create(
        m,
        dto.email,
        dto.name,
        'STUDENT',
        'Stu',
      );
      issued.push({
        name: dto.name,
        email: studentAccount.user.email,
        password: studentAccount.password,
      });

      const today = todayKst();
      const student = await m.save(
        m.create(Student, {
          userId: studentAccount.user.id,
          familyId: family.id,
          name: dto.name.trim(),
          birthDate: dto.birthDate,
          registeredAt: today,
        }),
      );
      await m.save(
        m.create(StudentSchoolHistory, {
          studentId: student.id,
          schoolId: school.id,
          changeType: '처음등록',
          enteredOn: dto.enteredOn,
          effectiveFrom: today,
        }),
      );

      const linked: string[] = [];
      for (const guardian of dto.guardians) {
        const result = await this.addGuardian(m, family.id, guardian);
        if (result.issued) issued.push(result.issued);
        if (result.linked) linked.push(result.linked);
      }
      return { studentId: student.id, familyId: family.id, issued, linked };
    });
  }

  private async addGuardian(
    m: EntityManager,
    familyId: number,
    g: GuardianDto,
  ) {
    const email = g.email?.trim();
    if (!email) {
      await m.save(
        m.create(ParentProfile, {
          familyId,
          relation: g.relation,
          name: g.name,
          phone: g.phone,
        }),
      );
      return {};
    }
    const existing = await this.accounts.findByEmail(m, email);
    if (existing) {
      if (existing.role !== 'PARENT')
        throw new ConflictException(
          `학부모 계정이 아닌 이메일이에요. (${email})`,
        );
      const profile = await m.findOneBy(ParentProfile, { userId: existing.id });
      if (profile?.familyId && profile.familyId !== familyId) {
        throw new ConflictException(
          `다른 가족에 연결된 학부모 계정이에요. (${email})`,
        );
      }
      // 먼저 직접 가입한 학부모 → 이 가족에 연결 (결정26)
      const target =
        profile ?? m.create(ParentProfile, { userId: existing.id });
      Object.assign(target, {
        familyId,
        relation: g.relation,
        name: g.name,
        phone: g.phone,
      });
      await m.save(target);
      return { linked: email };
    }
    const account = await this.accounts.create(m, email, g.name, 'PARENT');
    await m.save(
      m.create(ParentProfile, {
        userId: account.user.id,
        familyId,
        relation: g.relation,
        name: g.name,
        phone: g.phone,
      }),
    );
    return {
      issued: {
        name: g.name,
        email: account.user.email,
        password: account.password,
      },
    };
  }

  /** 전학·진학: 학적 이력에 행을 추가한다 (결정3·37) */
  async changeSchool(studentId: number, dto: SchoolChangeDto) {
    const student = await this.mustFind(studentId);
    const school = await this.dataSource
      .getRepository(School)
      .findOneBy({ id: dto.schoolId });
    if (!school) throw new BadRequestException('없는 학교예요.');
    if (dto.changeType === '진학' && school.level !== '고') {
      throw new BadRequestException('진학은 고등학교로만 고를 수 있어요.');
    }
    await this.dataSource.getRepository(StudentSchoolHistory).save({
      studentId: student.id,
      schoolId: school.id,
      changeType: dto.changeType,
      enteredOn: dto.enteredOn,
      effectiveFrom: dto.effectiveFrom,
      memo: dto.memo?.trim() || null,
    });
    return this.detail(studentId);
  }

  /** 학년 보정 (결정15) */
  async adjustGrade(
    studentId: number,
    staffId: number,
    dto: GradeAdjustmentDto,
  ) {
    await this.mustFind(studentId);
    await this.dataSource
      .getRepository(StudentGradeAdjustment)
      .save({ studentId, staffId, ...dto });
    return this.detail(studentId);
  }

  /** 상담·메모 추가 (결정38) */
  async addNote(studentId: number, dto: CounselNoteDto) {
    const student = await this.mustFind(studentId);
    if (dto.target === 'parent') {
      const profile = await this.dataSource
        .getRepository(ParentProfile)
        .findOneBy({
          id: dto.parentProfileId ?? 0,
          familyId: student.familyId,
        });
      if (!profile)
        throw new BadRequestException('이 가족의 보호자를 골라 주세요.');
    }
    await this.dataSource.getRepository(CounselNote).save({
      familyId: student.familyId,
      studentId: dto.target === 'student' ? student.id : null,
      parentProfileId: dto.target === 'parent' ? dto.parentProfileId : null,
      category: dto.category,
      notedOn: dto.notedOn,
      content: dto.content.trim(),
    });
    return this.detail(studentId);
  }

  /** 학생 계정 비밀번호 리셋 → 새 임시 비밀번호 */
  async resetStudentPassword(studentId: number) {
    const student = await this.mustFind(studentId);
    return this.dataSource.transaction(async (m) => {
      const user = await m.findOneByOrFail(AppUser, { id: student.userId });
      return {
        email: user.email,
        password: await this.accounts.resetPassword(m, user),
      };
    });
  }

  async schools(q?: string) {
    const qb = this.dataSource
      .getRepository(School)
      .createQueryBuilder('s')
      .orderBy('s.name');
    if (q?.trim())
      qb.where('s.name ILIKE :q OR s.region ILIKE :q', { q: `%${q.trim()}%` });
    return qb.getMany();
  }

  async createSchool(dto: CreateSchoolDto) {
    return this.dataSource.getRepository(School).save({
      name: dto.name.trim(),
      level: dto.level,
      region: dto.region.trim(),
    });
  }

  /** 가족 검색 — 학생 등록 때 기존 가족에 넣으려고 */
  async families(q?: string) {
    const params: unknown[] = [];
    let where = 'f.deleted_at IS NULL';
    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      where += ` AND (f.name ILIKE $1 OR EXISTS (SELECT 1 FROM hw2.parent_profile p WHERE p.family_id = f.id AND p.deleted_at IS NULL AND (p.name ILIKE $1 OR p.phone ILIKE $1)))`;
    }
    return this.dataSource.query(
      `SELECT f.id, f.name,
         COALESCE((SELECT json_agg(s.name ORDER BY s.registered_at) FROM hw2.student s WHERE s.family_id = f.id AND s.deleted_at IS NULL), '[]') AS students,
         COALESCE((SELECT json_agg(json_build_object('relation', p.relation, 'name', p.name, 'phone', p.phone, 'hasAccount', p.user_id IS NOT NULL) ORDER BY p.id)
           FROM hw2.parent_profile p WHERE p.family_id = f.id AND p.deleted_at IS NULL), '[]') AS guardians
       FROM hw2.family f WHERE ${where} ORDER BY f.name LIMIT 20`,
      params,
    );
  }

  private async mustFind(id: number): Promise<Student> {
    const student = await this.dataSource
      .getRepository(Student)
      .findOneBy({ id });
    if (!student) throw new NotFoundException('없는 학생이에요.');
    return student;
  }

  private toView(row: StudentRow) {
    const today = todayKst();
    const grade =
      row.level && row.entered_on
        ? currentGrade(
            {
              level: row.level,
              enteredOn: row.entered_on,
              adjustments: row.adjustments,
            },
            today,
          )
        : null;
    return {
      id: row.id,
      name: row.name,
      birthDate: row.birth_date,
      age: ageOn(row.birth_date, today),
      registeredAt: row.registered_at,
      grade,
      gradeLabel: grade === null ? '학교 없음' : gradeLabel(grade),
      schoolName: row.school_name,
      schoolRegion: row.region,
      enteredOn: row.entered_on,
      familyId: row.family_id,
      familyName: row.family_name,
      siblingOrder: row.sibling_order,
      email: row.email,
      accountStatus: !row.is_active
        ? '중지'
        : row.must_change_password
          ? '비번 변경 필요'
          : '사용',
    };
  }
}

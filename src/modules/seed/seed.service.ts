import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { DataSource, type EntityManager } from 'typeorm';
import type { AppEnv } from '../../config/env.js';
import { ClassSchedule } from '../classes/class-schedule.entity.js';
import { ClassEntity } from '../classes/class.entity.js';
import { CounselNote } from '../families/counsel-note.entity.js';
import { Family } from '../families/family.entity.js';
import { ParentProfile } from '../families/parent-profile.entity.js';
import { School } from '../students/school.entity.js';
import { StudentSchoolHistory } from '../students/student-school-history.entity.js';
import { Student } from '../students/student.entity.js';
import { Teacher } from '../teachers/teacher.entity.js';
import { AppUser } from '../users/app-user.entity.js';
import {
  SEED_CLASSES,
  SEED_FAMILIES,
  SEED_SCHOOLS,
  SEED_TEACHERS,
} from './seed-data.js';

/**
 * 빈 화면이 없도록 가상 데이터를 넣는다. 학생이 한 명도 없을 때만 한 번 실행한다.
 * 한 트랜잭션이라 중간에 실패하면 아무것도 남지 않는다. 시스템이 만든 행이라 created_by는 null.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onApplicationBootstrap() {
    if (await this.dataSource.getRepository(Student).exists()) return;
    const passwordHash = await bcrypt.hash(
      this.config.get('DEMO_PASSWORD', { infer: true }),
      10,
    );
    await this.dataSource.transaction((manager) =>
      this.seed(manager, passwordHash),
    );
    this.logger.log('데모 데이터를 넣었어요');
  }

  private async seed(m: EntityManager, passwordHash: string) {
    const account = (
      email: string,
      name: string,
      role: AppUser['role'],
      extra: Partial<AppUser> = {},
    ) =>
      m.save(m.create(AppUser, { email, name, role, passwordHash, ...extra }));

    const admin = await m.findOneByOrFail(AppUser, {
      email: this.config.get('ADMIN_EMAIL', { infer: true }).toLowerCase(),
    });

    const schools = new Map<string, School>();
    for (const s of SEED_SCHOOLS) {
      schools.set(
        s.key,
        await m.save(
          m.create(School, { name: s.name, level: s.level, region: s.region }),
        ),
      );
    }

    const teachers = new Map<string, { teacher: Teacher; userId: number }>();
    for (const t of SEED_TEACHERS) {
      const user = await account(t.email, t.name, 'TEACHER', {
        isActive: t.isActive,
        mustChangePassword: t.mustChangePassword,
      });
      const teacher = await m.save(
        m.create(Teacher, {
          userId: user.id,
          subject: t.subject,
          hiredAt: t.hiredAt,
        }),
      );
      teachers.set(t.key, { teacher, userId: user.id });
    }

    for (const c of SEED_CLASSES) {
      const cls = await m.save(
        m.create(ClassEntity, {
          name: c.name,
          targetGrade: c.targetGrade,
          teacherId: teachers.get(c.teacher)!.teacher.id,
          capacity: c.capacity,
          monthlyFee: c.monthlyFee,
          intro: c.intro,
        }),
      );
      for (const weekday of c.days) {
        await m.save(
          m.create(ClassSchedule, {
            classId: cls.id,
            weekday,
            startTime: c.start,
            endTime: c.end,
          }),
        );
      }
    }

    for (const f of SEED_FAMILIES) {
      const family = await m.save(m.create(Family, { name: f.name }));
      const parents = new Map<string, ParentProfile>();
      for (const p of f.parents) {
        const user = p.email ? await account(p.email, p.name, 'PARENT') : null;
        parents.set(
          p.name,
          await m.save(
            m.create(ParentProfile, {
              userId: user?.id ?? null,
              familyId: family.id,
              relation: p.relation,
              name: p.name,
              phone: p.phone,
            }),
          ),
        );
      }
      const students = new Map<string, Student>();
      for (const s of f.students) {
        const user = await account(s.email, s.name, 'STUDENT');
        const student = await m.save(
          m.create(Student, {
            userId: user.id,
            familyId: family.id,
            name: s.name,
            birthDate: s.birthDate,
            registeredAt: s.registeredAt,
          }),
        );
        students.set(s.name, student);
        for (const h of s.schools) {
          await m.save(
            m.create(StudentSchoolHistory, {
              studentId: student.id,
              schoolId: schools.get(h.school)!.id,
              changeType: h.changeType,
              enteredOn: h.enteredOn,
              effectiveFrom: h.effectiveFrom,
              memo: h.memo ?? null,
            }),
          );
        }
      }
      for (const n of f.notes) {
        // 작성자는 created_by로 남긴다 (시드라 직접 넣음)
        const by = n.by === 'admin' ? admin.id : teachers.get(n.by)!.userId;
        await m.save(
          m.create(CounselNote, {
            familyId: family.id,
            studentId: n.student ? students.get(n.student)!.id : null,
            parentProfileId: n.parent ? parents.get(n.parent)!.id : null,
            category: n.category,
            notedOn: n.notedOn,
            content: n.content,
            createdBy: by,
            updatedBy: by,
          }),
        );
      }
    }
  }
}

import type { EntityManager } from 'typeorm';
import { addDays, todayKst } from '../../common/time/kst.js';
import { Attendance } from '../attendance/attendance.entity.js';
import { ClassSession } from '../classes/class-session.entity.js';
import { monthSessions } from '../classes/schedule-rules.js';
import { Enrollment } from '../enrollments/enrollment.entity.js';
import { Family } from '../families/family.entity.js';
import { ParentProfile } from '../families/parent-profile.entity.js';
import { StudentSchoolHistory } from '../students/student-school-history.entity.js';
import { Student } from '../students/student.entity.js';
import { AppUser } from '../users/app-user.entity.js';
import {
  SEED_APPLICATIONS,
  SEED_ATTENDANCE_RULES,
  SEED_ENROLLMENTS,
  SEED_FILLERS,
} from './seed-data.js';

/** 데모 2단계: 수강·이번 달/다음 달 수업일·이번 달 지난 수업 출결 */
export async function seedClasswork(m: EntityManager, passwordHash: string) {
  const today = todayKst();
  const month = today.slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const classes: { id: number; name: string }[] = await m.query(
    `SELECT id, name FROM hw2.class WHERE deleted_at IS NULL`,
  );
  const classId = (name: string) => classes.find((c) => c.name === name)!.id;

  // 정원 채우기용 학생 (중2, 각자 가족 + 계정 없는 보호자 연락처)
  const [school] = await m.query(
    `SELECT id FROM hw2.school WHERE name = '대치중학교'`,
  );
  for (const [i, name] of SEED_FILLERS.entries()) {
    const family = await m.save(m.create(Family, { name: `${name} 가족` }));
    await m.save(
      m.create(ParentProfile, {
        familyId: family.id,
        relation: '모',
        name: `${name[0]}보호자`,
        phone: `010-7000-${1000 + i}`,
      }),
    );
    const user = await m.save(
      m.create(AppUser, {
        email: `filler${i + 1}@naver.com`,
        name,
        role: 'STUDENT',
        passwordHash,
      }),
    );
    const student = await m.save(
      m.create(Student, {
        userId: user.id,
        familyId: family.id,
        name,
        birthDate: '2013-06-01',
        registeredAt: '2026-03-02',
      }),
    );
    await m.save(
      m.create(StudentSchoolHistory, {
        studentId: student.id,
        schoolId: school.id,
        changeType: '처음등록',
        enteredOn: '2025-03-03',
        effectiveFrom: '2025-03-03',
      }),
    );
  }
  const students: { id: number; name: string }[] = await m.query(
    `SELECT id, name FROM hw2.student WHERE deleted_at IS NULL`,
  );
  const studentId = (name: string) => students.find((s) => s.name === name)!.id;

  for (const e of SEED_ENROLLMENTS) {
    await m.save(
      m.create(Enrollment, {
        studentId: studentId(e.student),
        classId: classId(e.className),
        status: '수강중',
        startDate: e.startDate,
        decidedAt: new Date(),
      }),
    );
  }
  for (const a of SEED_APPLICATIONS) {
    const [parent] = await m.query(
      `SELECT p.id FROM hw2.parent_profile p JOIN hw2.student s ON s.family_id = p.family_id WHERE s.name = $1 AND p.user_id IS NOT NULL LIMIT 1`,
      [a.student],
    );
    await m.save(
      m.create(Enrollment, {
        studentId: studentId(a.student),
        classId: classId(a.className),
        status: '신청됨',
        startDate: today,
        appliedByParentId: parent?.id ?? null,
      }),
    );
  }

  // 수업일: 이번 달 + 다음 달
  const schedules: {
    classId: number;
    weekday: number;
    startTime: string;
    endTime: string;
  }[] = await m.query(
    `SELECT class_id AS "classId", weekday, to_char(start_time, 'HH24:MI') AS "startTime", to_char(end_time, 'HH24:MI') AS "endTime" FROM hw2.class_schedule WHERE deleted_at IS NULL`,
  );
  for (const c of classes) {
    const slots = schedules.filter((s) => s.classId === c.id);
    for (const ym of [month, nextMonth]) {
      for (const s of monthSessions(slots, ym))
        await m.save(m.create(ClassSession, { classId: c.id, ...s }));
    }
  }
  // 월초라 지난 수업이 적으면 중2 심화A에 월초 보충 수업을 둔다 (결정35) — 보강 필요(C14) 예시를 위해
  const [{ n }] = await m.query(
    `SELECT count(*)::int AS n FROM hw2.class_session WHERE class_id = $1 AND date <= $2 AND to_char(date, 'YYYY-MM') = $3`,
    [classId('중2 심화A'), today, month],
  );
  if (n < 2) {
    await m.save(
      m.create(ClassSession, {
        classId: classId('중2 심화A'),
        date: `${month}-01`,
        startTime: '14:00',
        endTime: '16:00',
        kind: '보충',
        memo: '월초 보충',
      }),
    );
  }

  // 이번 달 지난 수업 출결
  const past: { id: number; classId: number; startTime: string }[] =
    await m.query(
      `SELECT id, class_id AS "classId", to_char(start_time, 'HH24:MI') AS "startTime" FROM hw2.class_session
     WHERE date <= $1 AND to_char(date, 'YYYY-MM') = $2 AND status = '정상' ORDER BY date, start_time`,
      [today, month],
    );
  const seen = new Map<number, number>();
  for (const session of past) {
    const roster: { student_id: number; name: string }[] = await m.query(
      `SELECT e.student_id, s.name FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id WHERE e.class_id = $1 AND e.status = '수강중'`,
      [session.classId],
    );
    for (const r of roster) {
      const index = seen.get(r.student_id) ?? 0;
      seen.set(r.student_id, index + 1);
      const rule = SEED_ATTENDANCE_RULES[r.name]?.(index) ?? {
        status: '출석' as const,
      };
      const [h, mm] = session.startTime.split(':').map(Number);
      const total = mm + (rule.late ?? 0);
      const arrived = rule.late
        ? `${String(h + Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
        : null;
      await m.save(
        m.create(Attendance, {
          sessionId: session.id,
          studentId: r.student_id,
          status: rule.status,
          arrivedAt: arrived,
        }),
      );
    }
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import { addDays, mondayOf, todayKst } from '../../common/time/kst.js';
import { ClassSession } from '../classes/class-session.entity.js';
import { attendanceRate, makeupProblem } from './attendance-rules.js';
import { Attendance } from './attendance.entity.js';
import type {
  CancelSessionDto,
  ExtraSessionDto,
  SaveAttendanceDto,
} from './attendance.dto.js';
import { Makeup } from './makeup.entity.js';

/** 그 수업일에 다니는 수강생 (그만둔 날 이후는 빼고) + 확정된 보강생 */
const ROSTER_SQL = `
  SELECT st.id AS "studentId", st.name, '수강' AS "attendType", NULL::int AS "makeupId", NULL AS "fromClass"
  FROM hw2.class_session s
  JOIN hw2.enrollment e ON e.class_id = s.class_id AND e.deleted_at IS NULL
    AND e.status IN ('수강중', '환불요청', '수강종료') AND e.start_date <= s.date AND (e.end_date IS NULL OR e.end_date >= s.date)
  JOIN hw2.student st ON st.id = e.student_id
  WHERE s.id = $1
  UNION ALL
  SELECT st.id, st.name, '보강', m.id, c2.name || ' ' || to_char(s2.date, 'MM/DD') || ' 결석분'
  FROM hw2.makeup m
  JOIN hw2.attendance a ON a.id = m.absence_attendance_id
  JOIN hw2.student st ON st.id = a.student_id
  JOIN hw2.class_session s2 ON s2.id = a.session_id
  JOIN hw2.class c2 ON c2.id = s2.class_id
  WHERE m.target_session_id = $1 AND m.status = '확정' AND m.deleted_at IS NULL`;

interface RosterRow {
  studentId: number;
  name: string;
  attendType: '수강' | '보강';
  makeupId: number | null;
  fromClass: string | null;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly dataSource: DataSource) {}

  // ───────── 수업일 (휴강·보충) ─────────

  /** 휴강 처리 + (있으면) 같은 반 보충 수업 (결정14) */
  async cancelSession(sessionId: number, dto: CancelSessionDto) {
    return this.dataSource.transaction(async (m) => {
      const session = await m.findOneBy(ClassSession, { id: sessionId });
      if (!session) throw new NotFoundException('없는 수업이에요.');
      if (session.status === '휴강')
        throw new BadRequestException('이미 휴강한 수업이에요.');
      const [{ n }] = await m.query(
        `SELECT count(*)::int AS n FROM hw2.attendance WHERE session_id = $1 AND deleted_at IS NULL`,
        [sessionId],
      );
      if (n > 0)
        throw new BadRequestException('출결을 입력한 수업은 휴강할 수 없어요.');
      session.status = '휴강';
      session.memo = dto.memo?.trim() || session.memo;
      await m.save(session);
      if (dto.replacement) {
        await this.addExtra(m, session.classId, dto.replacement, session.id);
      }
      return { ok: true };
    });
  }

  /** 보충 수업 추가 — 휴강이 없어도 만들 수 있다 (결정35) */
  async addExtraSession(classId: number, dto: ExtraSessionDto) {
    return this.dataSource.transaction((m) =>
      this.addExtra(m, classId, dto, null),
    );
  }

  private async addExtra(
    m: EntityManager,
    classId: number,
    dto: ExtraSessionDto,
    replaces: number | null,
  ) {
    if (dto.endTime <= dto.startTime)
      throw new BadRequestException('끝나는 시간이 시작 시간보다 늦어야 해요.');
    const saved = await m.save(
      m.create(ClassSession, {
        classId,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        kind: '보충',
        replacesSessionId: replaces,
        memo: dto.memo?.trim() || (replaces ? '휴강 대체' : null),
      }),
    );
    return { id: saved.id };
  }

  // ───────── 출결 입력 ─────────

  /** 그날 수업 목록 — 강사는 담당 반만 (결정18) */
  async sessionsOn(user: AuthUser, date: string) {
    return this.dataSource.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
         s.status, s.kind, c.id AS "classId", c.name AS "className", u.name AS "teacherName",
         (SELECT count(*) FROM hw2.attendance a WHERE a.session_id = s.id AND a.deleted_at IS NULL)::int AS recorded
       FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id JOIN hw2.teacher t ON t.id = c.teacher_id JOIN hw2.app_user u ON u.id = t.user_id
       WHERE s.date = $1 AND s.deleted_at IS NULL AND ($2::int IS NULL OR t.user_id = $2)
       ORDER BY s.start_time, c.name`,
      [date, user.role === 'TEACHER' ? user.id : null],
    );
  }

  async roster(user: AuthUser, sessionId: number) {
    const session = await this.ownSession(user, sessionId);
    const roster: RosterRow[] = await this.dataSource.query(
      `${ROSTER_SQL} ORDER BY 3 DESC, 2`,
      [sessionId],
    );
    const records: {
      studentId: number;
      status: string;
      arrivedAt: string | null;
    }[] = await this.dataSource.query(
      `SELECT student_id AS "studentId", status, to_char(arrived_at, 'HH24:MI') AS "arrivedAt" FROM hw2.attendance WHERE session_id = $1 AND deleted_at IS NULL`,
      [sessionId],
    );
    const notes: { studentId: number; n: number }[] =
      await this.dataSource.query(
        `SELECT student_id AS "studentId", count(*)::int AS n FROM hw2.counsel_note WHERE student_id = ANY($1) AND deleted_at IS NULL GROUP BY student_id`,
        [roster.map((r) => r.studentId)],
      );
    return {
      session,
      students: roster.map((r) => ({
        ...r,
        record: records.find((x) => x.studentId === r.studentId) ?? null,
        noteCount: notes.find((x) => x.studentId === r.studentId)?.n ?? 0,
      })),
    };
  }

  /** 출결 저장 (B10). 같은 학생·수업은 하나 — 있으면 고친다 */
  async saveAttendance(
    user: AuthUser,
    sessionId: number,
    dto: SaveAttendanceDto,
  ) {
    const session = await this.ownSession(user, sessionId);
    if (session.status === '휴강')
      throw new BadRequestException('휴강한 수업에는 출결을 넣을 수 없어요.');
    if (session.date > todayKst())
      throw new BadRequestException('아직 열리지 않은 수업이에요.');
    return this.dataSource.transaction(async (m) => {
      const roster: RosterRow[] = await m.query(ROSTER_SQL, [sessionId]);
      for (const row of dto.rows) {
        const who = roster.find((r) => r.studentId === row.studentId);
        if (!who) throw new BadRequestException('이 수업 학생이 아니에요.');
        const existing = await m.findOneBy(Attendance, {
          sessionId,
          studentId: row.studentId,
        });
        const record =
          existing ??
          m.create(Attendance, { sessionId, studentId: row.studentId });
        Object.assign(record, {
          attendType: who.attendType,
          makeupId: who.makeupId,
          status: row.status,
          arrivedAt:
            row.status === '결석'
              ? null
              : row.status === '지각'
                ? (row.arrivedAt ?? null)
                : (row.arrivedAt ?? null),
          recordedBy: user.id,
        });
        if (row.status === '지각' && !row.arrivedAt)
          throw new BadRequestException(
            `${who.name}의 도착 시각을 적어 주세요.`,
          );
        await m.save(record);
      }
      return { saved: dto.rows.length };
    });
  }

  private async ownSession(user: AuthUser, sessionId: number) {
    const [session] = await this.dataSource.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
         s.status, s.kind, c.id AS "classId", c.name AS "className", c.capacity, t.user_id AS "teacherUserId"
       FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id JOIN hw2.teacher t ON t.id = c.teacher_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [sessionId],
    );
    if (!session) throw new NotFoundException('없는 수업이에요.');
    if (user.role === 'TEACHER' && session.teacherUserId !== user.id)
      throw new ForbiddenException('담당 반 수업만 볼 수 있어요.');
    return session as {
      id: number;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      kind: string;
      classId: number;
      className: string;
      capacity: number;
    };
  }

  // ───────── 보강 ─────────

  /** 그날 인원 = 원래 수강생 + 확정된 보강생 (B11) */
  private async headcount(
    m: EntityManager,
    sessionId: number,
  ): Promise<number> {
    const [{ n }] = await m.query(
      `SELECT count(*)::int AS n FROM (${ROSTER_SQL}) r`,
      [sessionId],
    );
    return n;
  }

  private async evaluate(
    m: EntityManager,
    absenceId: number,
    targetSessionId: number,
    exceptMakeupId: number | null = null,
  ) {
    const [absence] = await m.query(
      `SELECT a.id, a.student_id AS "studentId", a.status, to_char(s.date, 'YYYY-MM-DD') AS date, s.class_id AS "classId", c.target_grade AS "targetGrade"
       FROM hw2.attendance a JOIN hw2.class_session s ON s.id = a.session_id JOIN hw2.class c ON c.id = s.class_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [absenceId],
    );
    if (!absence) throw new NotFoundException('없는 결석 기록이에요.');
    const [target] = await m.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
         s.status, s.class_id AS "classId", c.target_grade AS "targetGrade", c.capacity
       FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [targetSessionId],
    );
    if (!target) throw new NotFoundException('없는 수업이에요.');
    const [{ n: absencesInMonth }] = await m.query(
      `SELECT count(*)::int AS n FROM hw2.attendance a JOIN hw2.class_session s ON s.id = a.session_id
       WHERE a.student_id = $1 AND a.status = '결석' AND a.attend_type = '수강' AND a.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $2`,
      [absence.studentId, absence.date.slice(0, 7)],
    );
    // 학생이 그 시간에 다니는 다른 수업 (자기 반 정규·보충, 확정된 다른 보강)
    const [{ n: busy }] = await m.query(
      `SELECT count(*)::int AS n FROM hw2.class_session s
       WHERE s.date = $2 AND s.status = '정상' AND s.deleted_at IS NULL AND s.id <> $3
         AND s.start_time < $5::time AND $4::time < s.end_time
         AND (EXISTS (SELECT 1 FROM hw2.enrollment e WHERE e.class_id = s.class_id AND e.student_id = $1 AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL)
           OR EXISTS (SELECT 1 FROM hw2.makeup mk JOIN hw2.attendance aa ON aa.id = mk.absence_attendance_id
             WHERE mk.target_session_id = s.id AND aa.student_id = $1 AND mk.status = '확정' AND mk.deleted_at IS NULL AND ($6::int IS NULL OR mk.id <> $6)))`,
      [
        absence.studentId,
        target.date,
        target.id,
        target.startTime,
        target.endTime,
        exceptMakeupId,
      ],
    );
    const problem = makeupProblem({
      absence,
      absencesInMonth,
      target: { ...target, headcount: await this.headcount(m, target.id) },
      studentBusy: busy > 0,
      today: todayKst(),
    });
    return { absence, target, problem };
  }

  /** 학부모·관리자: 이 학생의 이번 달 결석과 들어갈 수 있는 수업 */
  async makeupOptions(studentId: number) {
    const month = todayKst().slice(0, 7);
    const absences: {
      id: number;
      date: string;
      className: string;
      startTime: string;
      classId: number;
      targetGrade: number;
      makeupStatus: string | null;
    }[] = await this.dataSource.query(
      `SELECT a.id, to_char(s.date, 'YYYY-MM-DD') AS date, c.name AS "className", to_char(s.start_time, 'HH24:MI') AS "startTime", c.id AS "classId", c.target_grade AS "targetGrade",
           (SELECT mk.status FROM hw2.makeup mk WHERE mk.absence_attendance_id = a.id AND mk.status <> '거절' AND mk.deleted_at IS NULL LIMIT 1) AS "makeupStatus"
         FROM hw2.attendance a JOIN hw2.class_session s ON s.id = a.session_id JOIN hw2.class c ON c.id = s.class_id
         WHERE a.student_id = $1 AND a.status = '결석' AND a.attend_type = '수강' AND a.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $2
         ORDER BY s.date`,
      [studentId, month],
    );
    const grades = [...new Set(absences.map((a) => a.targetGrade))];
    const candidates: {
      id: number;
      date: string;
      startTime: string;
      endTime: string;
      className: string;
      teacherName: string;
      classId: number;
      capacity: number;
    }[] =
      grades.length === 0
        ? []
        : await this.dataSource.query(
            `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
               c.name AS "className", u.name AS "teacherName", c.id AS "classId", c.capacity
             FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id JOIN hw2.teacher t ON t.id = c.teacher_id JOIN hw2.app_user u ON u.id = t.user_id
             WHERE c.target_grade = ANY($1) AND s.status = '정상' AND s.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $2 AND s.date >= $3
             ORDER BY s.date, s.start_time`,
            [grades, month, todayKst()],
          );
    const open = absences.find((a) => !a.makeupStatus);
    const targets = open
      ? await Promise.all(
          candidates
            .filter((c) => c.classId !== open.classId)
            .map(async (c) => {
              const { problem } = await this.evaluate(
                this.dataSource.manager,
                open.id,
                c.id,
              );
              return {
                ...c,
                headcount: await this.headcount(this.dataSource.manager, c.id),
                problem,
              };
            }),
        )
      : [];
    return {
      absences,
      absencesInMonth: absences.length,
      targets,
      forAbsenceId: open?.id ?? null,
    };
  }

  async requestMakeup(absenceId: number, targetSessionId: number) {
    return this.dataSource.transaction(async (m) => {
      const { problem } = await this.evaluate(m, absenceId, targetSessionId);
      if (problem)
        throw new BadRequestException(`보강을 신청할 수 없어요. ${problem}`);
      const saved = await m.save(
        m.create(Makeup, {
          absenceAttendanceId: absenceId,
          targetSessionId,
          status: '신청',
        }),
      );
      return { id: saved.id };
    });
  }

  async decideMakeup(id: number, staffId: number, decision: '확정' | '거절') {
    return this.dataSource.transaction(async (m) => {
      const makeup = await m.findOneBy(Makeup, { id });
      if (!makeup) throw new NotFoundException('없는 보강이에요.');
      if (makeup.status !== '신청')
        throw new BadRequestException(
          `이미 처리된 보강이에요. (${makeup.status})`,
        );
      if (decision === '확정') {
        await m.query(
          `SELECT id FROM hw2.class_session WHERE id = $1 FOR UPDATE`,
          [makeup.targetSessionId],
        );
        const { problem } = await this.evaluate(
          m,
          makeup.absenceAttendanceId,
          makeup.targetSessionId,
          makeup.id,
        );
        if (problem)
          throw new BadRequestException(`확정할 수 없어요. ${problem}`);
      }
      Object.assign(makeup, { status: decision, decidedBy: staffId });
      await m.save(makeup);
      return { ok: true };
    });
  }

  /** 보강 목록 — 강사는 내 반 학생 결석분과 내 반에 들어오는 보강만 */
  async makeups(user: AuthUser) {
    const rows: {
      id: number;
      status: string;
      absenceId: number;
      targetSessionId: number;
    }[] = await this.dataSource.query(
      `SELECT mk.id, mk.status, mk.absence_attendance_id AS "absenceId", mk.target_session_id AS "targetSessionId",
         st.id AS "studentId", st.name AS "studentName",
         to_char(s1.date, 'YYYY-MM-DD') AS "absenceDate", c1.name AS "absenceClass",
         to_char(s2.date, 'YYYY-MM-DD') AS "targetDate", to_char(s2.start_time, 'HH24:MI') AS "targetTime", c2.name AS "targetClass", c2.capacity
       FROM hw2.makeup mk
       JOIN hw2.attendance a ON a.id = mk.absence_attendance_id JOIN hw2.student st ON st.id = a.student_id
       JOIN hw2.class_session s1 ON s1.id = a.session_id JOIN hw2.class c1 ON c1.id = s1.class_id
       JOIN hw2.class_session s2 ON s2.id = mk.target_session_id JOIN hw2.class c2 ON c2.id = s2.class_id
       WHERE mk.deleted_at IS NULL
         AND ($1::int IS NULL OR EXISTS (SELECT 1 FROM hw2.teacher t WHERE t.user_id = $1 AND t.id IN (c1.teacher_id, c2.teacher_id)))
       ORDER BY (mk.status = '신청') DESC, s2.date DESC LIMIT 200`,
      [user.role === 'TEACHER' ? user.id : null],
    );
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        headcount: await this.headcount(
          this.dataSource.manager,
          row.targetSessionId,
        ),
        problem:
          row.status === '신청'
            ? (
                await this.evaluate(
                  this.dataSource.manager,
                  row.absenceId,
                  row.targetSessionId,
                  row.id,
                )
              ).problem
            : null,
      })),
    );
  }

  /** C14: 이번 달 결석 2회 이상인데 보강(신청·확정)이 없는 학생 — 강사는 내 반 학생만 */
  async needsMakeup(user: AuthUser | null, month = todayKst().slice(0, 7)) {
    return this.dataSource.query(
      `SELECT st.id AS "studentId", st.name AS "studentName", count(*)::int AS absences,
         string_agg(DISTINCT c.name, ', ') AS classes, max(to_char(s.date, 'YYYY-MM-DD')) AS "lastAbsence"
       FROM hw2.attendance a JOIN hw2.class_session s ON s.id = a.session_id JOIN hw2.class c ON c.id = s.class_id JOIN hw2.student st ON st.id = a.student_id
       WHERE a.status = '결석' AND a.attend_type = '수강' AND a.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $1
         AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM hw2.teacher t WHERE t.user_id = $2 AND t.id = c.teacher_id))
       GROUP BY st.id, st.name
       HAVING count(*) >= 2 AND NOT EXISTS (
         SELECT 1 FROM hw2.makeup mk JOIN hw2.attendance a2 ON a2.id = mk.absence_attendance_id
         WHERE a2.student_id = st.id AND mk.status IN ('신청', '확정') AND mk.deleted_at IS NULL)
       ORDER BY count(*) DESC`,
      [month, user?.role === 'TEACHER' ? user.id : null],
    );
  }

  // ───────── 학생·학부모 보기 ─────────

  /** 학생 계정 → 학생 id */
  async studentIdOfUser(userId: number): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT id FROM hw2.student WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!row) throw new NotFoundException('학생 정보가 없어요.');
    return row.id;
  }

  /** 결석 기록 → 학생 id (학부모 소유 확인용) */
  async studentOfAttendance(attendanceId: number): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT student_id FROM hw2.attendance WHERE id = $1 AND deleted_at IS NULL`,
      [attendanceId],
    );
    if (!row) throw new NotFoundException('없는 결석 기록이에요.');
    return row.student_id;
  }

  /** 주간 스케줄: 다니는 반 수업(휴강·보충 포함) + 확정된 보강 */
  async weekSchedule(studentId: number, anyDate: string) {
    const from = mondayOf(anyDate);
    const to = addDays(from, 6);
    const sessions = await this.dataSource.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
         s.status, s.kind, c.name AS "className", '수강' AS "attendType", s.memo
       FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id
       JOIN hw2.enrollment e ON e.class_id = c.id AND e.student_id = $1 AND e.deleted_at IS NULL
         AND e.status IN ('수강중', '환불요청', '수강종료') AND e.start_date <= s.date AND (e.end_date IS NULL OR e.end_date >= s.date)
       WHERE s.date BETWEEN $2 AND $3 AND s.deleted_at IS NULL
       UNION ALL
       SELECT s.id, to_char(s.date, 'YYYY-MM-DD'), to_char(s.start_time, 'HH24:MI'), to_char(s.end_time, 'HH24:MI'), s.status, s.kind, c.name, '보강', NULL
       FROM hw2.makeup mk JOIN hw2.attendance a ON a.id = mk.absence_attendance_id
       JOIN hw2.class_session s ON s.id = mk.target_session_id JOIN hw2.class c ON c.id = s.class_id
       WHERE a.student_id = $1 AND mk.status = '확정' AND mk.deleted_at IS NULL AND s.date BETWEEN $2 AND $3
       ORDER BY 2, 3`,
      [studentId, from, to],
    );
    return { from, to, sessions };
  }

  /** 월 출석 기록 + 출석률 (C13) */
  async monthAttendance(studentId: number, month: string) {
    const records: {
      date: string;
      status: string;
      attendType: string;
      sessionStatus: string;
      kind: string;
    }[] = await this.dataSource.query(
      `SELECT to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", c.name AS "className",
         a.status, a.attend_type AS "attendType", to_char(a.arrived_at, 'HH24:MI') AS "arrivedAt",
         CASE WHEN a.status = '지각' AND a.arrived_at IS NOT NULL THEN (EXTRACT(EPOCH FROM (a.arrived_at - s.start_time)) / 60)::int END AS "lateMinutes",
         s.status AS "sessionStatus", s.kind,
         (SELECT to_char(s2.date, 'MM/DD') FROM hw2.makeup mk JOIN hw2.class_session s2 ON s2.id = mk.target_session_id
            WHERE mk.absence_attendance_id = a.id AND mk.status <> '거절' AND mk.deleted_at IS NULL LIMIT 1) AS "makeupDate",
         (SELECT mk.status FROM hw2.makeup mk WHERE mk.absence_attendance_id = a.id AND mk.status <> '거절' AND mk.deleted_at IS NULL LIMIT 1) AS "makeupStatus"
       FROM hw2.attendance a JOIN hw2.class_session s ON s.id = a.session_id JOIN hw2.class c ON c.id = s.class_id
       WHERE a.student_id = $1 AND a.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $2
       ORDER BY s.date, s.start_time`,
      [studentId, month],
    );
    const canceled = await this.dataSource.query(
      `SELECT to_char(s.date, 'YYYY-MM-DD') AS date, c.name AS "className",
         (SELECT to_char(r.date, 'MM/DD') FROM hw2.class_session r WHERE r.replaces_session_id = s.id AND r.deleted_at IS NULL LIMIT 1) AS "replacedOn"
       FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id
       JOIN hw2.enrollment e ON e.class_id = c.id AND e.student_id = $1 AND e.status IN ('수강중', '환불요청', '수강종료') AND e.deleted_at IS NULL
         AND e.start_date <= s.date AND (e.end_date IS NULL OR e.end_date >= s.date)
       WHERE s.status = '휴강' AND s.deleted_at IS NULL AND to_char(s.date, 'YYYY-MM') = $2`,
      [studentId, month],
    );
    const own = records.filter((r) => r.attendType === '수강');
    const count = { 출석: 0, 지각: 0, 결석: 0 };
    for (const r of own) count[r.status as keyof typeof count]++;
    return {
      month,
      ...count,
      makeups: records.filter((r) => r.attendType === '보강').length,
      ...attendanceRate(count),
      records,
      canceled,
    };
  }
}

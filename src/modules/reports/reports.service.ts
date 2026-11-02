import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import { addDays, mondayOf, todayKst } from '../../common/time/kst.js';
import { attendanceRate } from '../attendance/attendance-rules.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { ClassesService } from '../classes/classes.service.js';
import { PaymentsService } from '../payments/payments.service.js';

/** 대시보드·현황 (C13·C14·C15, 결정 대시보드). 저장하지 않고 원본에서 매번 센다 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly attendance: AttendanceService,
    private readonly payments: PaymentsService,
    private readonly classes: ClassesService,
  ) {}

  /** C13: 학생별 이번 달 출석률 (지각 3 = 결석 1, 학생 전체·월 합산). teacherUserId면 그 강사 반 학생만 */
  async attendanceRates(month: string, teacherUserId: number | null = null) {
    const rows: {
      studentId: number;
      name: string;
      classes: string;
      출석: number;
      지각: number;
      결석: number;
      makeups: number;
    }[] = await this.dataSource.query(
      `SELECT st.id AS "studentId", st.name,
         (SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM hw2.enrollment e JOIN hw2.class c ON c.id = e.class_id
           WHERE e.student_id = st.id AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL) AS classes,
         count(*) FILTER (WHERE a.status = '출석' AND a.attend_type = '수강')::int AS "출석",
         count(*) FILTER (WHERE a.status = '지각' AND a.attend_type = '수강')::int AS "지각",
         count(*) FILTER (WHERE a.status = '결석' AND a.attend_type = '수강')::int AS "결석",
         count(*) FILTER (WHERE a.attend_type = '보강')::int AS makeups
       FROM hw2.student st
       JOIN hw2.attendance a ON a.student_id = st.id AND a.deleted_at IS NULL
       JOIN hw2.class_session s ON s.id = a.session_id AND to_char(s.date, 'YYYY-MM') = $1
       WHERE st.deleted_at IS NULL
         AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM hw2.enrollment e JOIN hw2.class c ON c.id = e.class_id JOIN hw2.teacher t ON t.id = c.teacher_id
           WHERE e.student_id = st.id AND t.user_id = $2 AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL))
       GROUP BY st.id, st.name`,
      [month, teacherUserId],
    );
    return rows
      .map((r) => ({ ...r, ...attendanceRate(r) }))
      .sort(
        (a, b) =>
          (a.rate ?? 101) - (b.rate ?? 101) || a.name.localeCompare(b.name),
      );
  }

  async adminDashboard() {
    const today = todayKst();
    const month = today.slice(0, 7);
    const [bills, rates, needs, classes] = await Promise.all([
      this.payments.bills(month),
      this.attendanceRates(month),
      this.attendance.needsMakeup(null, month),
      this.classes.list(),
    ]);
    const [counts] = await this.dataSource.query(
      `SELECT
         (SELECT count(DISTINCT student_id) FROM hw2.enrollment WHERE status IN ('수강중', '환불요청') AND deleted_at IS NULL)::int AS active,
         (SELECT count(DISTINCT student_id) FROM hw2.enrollment WHERE status IN ('수강중', '환불요청') AND to_char(start_date, 'YYYY-MM') = $1 AND deleted_at IS NULL)::int AS "newThisMonth",
         (SELECT count(*) FROM hw2.enrollment WHERE status = '수강종료' AND to_char(end_date, 'YYYY-MM') = $1 AND deleted_at IS NULL)::int AS "endedThisMonth",
         (SELECT COALESCE(sum(refund_amount), 0) FROM hw2.enrollment WHERE status = '수강종료' AND to_char(end_date, 'YYYY-MM') = $1 AND deleted_at IS NULL)::int AS refunds,
         (SELECT count(*) FROM hw2.enrollment WHERE status = '신청됨' AND deleted_at IS NULL)::int AS "pendingEnrollments",
         (SELECT count(*) FROM hw2.enrollment WHERE status = '환불요청' AND deleted_at IS NULL)::int AS "pendingRefunds",
         (SELECT count(*) FROM hw2.makeup WHERE status = '신청' AND deleted_at IS NULL)::int AS "pendingMakeups"`,
      [month],
    );
    const unpaid = bills.filter((b) => !b.payment && b.status !== '수강종료');
    const withRate = rates.filter((r) => r.rate !== null);
    return {
      month,
      today,
      revenue: {
        billed: bills.reduce(
          (s, b) => s + (b.payment?.paidAmount ?? b.expectedCharge),
          0,
        ),
        received: bills.reduce((s, b) => s + (b.payment?.paidAmount ?? 0), 0),
        unpaid: unpaid.reduce((s, b) => s + b.expectedCharge, 0),
        siblingDiscount: bills.reduce(
          (s, b) =>
            s +
            (b.payment
              ? b.payment.discountType === '형제'
                ? b.payment.discountAmount
                : 0
              : b.expectedDiscount),
          0,
        ),
        refunds: counts.refunds,
      },
      students: {
        active: counts.active,
        newThisMonth: counts.newThisMonth,
        endedThisMonth: counts.endedThisMonth,
      },
      pending: {
        enrollments: counts.pendingEnrollments,
        refunds: counts.pendingRefunds,
        makeups: counts.pendingMakeups,
      },
      averageRate: withRate.length
        ? Math.round(
            withRate.reduce((s, r) => s + (r.rate ?? 0), 0) / withRate.length,
          )
        : null,
      classes,
      rates,
      needsMakeup: needs,
      unpaid: unpaid.map((b) => ({
        enrollmentId: b.enrollmentId,
        studentName: b.studentName,
        familyName: b.familyName,
        className: b.className,
        listPrice: b.listPrice,
        discount: b.expectedDiscount,
        charge: b.expectedCharge,
        siblingOrder: b.siblingOrder,
      })),
    };
  }

  /** D19 학부모 자녀 요약: 출석·보강·결제할 금액·수강 중인 반·할 일 */
  async parentSummary(studentId: number, familyId: number) {
    const month = todayKst().slice(0, 7);
    const [attendance, bills, options] = await Promise.all([
      this.attendance.monthAttendance(studentId, month),
      this.payments.bills(month, familyId),
      this.attendance.makeupOptions(studentId),
    ]);
    const classes = await this.dataSource.query(
      `SELECT c.name, e.status, u.name AS "teacherName",
         COALESCE((SELECT json_agg(json_build_object('weekday', cs.weekday, 'startTime', to_char(cs.start_time, 'HH24:MI'), 'endTime', to_char(cs.end_time, 'HH24:MI')) ORDER BY cs.weekday)
           FROM hw2.class_schedule cs WHERE cs.class_id = c.id AND cs.deleted_at IS NULL), '[]') AS schedules
       FROM hw2.enrollment e JOIN hw2.class c ON c.id = e.class_id JOIN hw2.teacher t ON t.id = c.teacher_id JOIN hw2.app_user u ON u.id = t.user_id
       WHERE e.student_id = $1 AND e.status IN ('수강중', '환불요청', '신청됨') AND e.deleted_at IS NULL ORDER BY c.name`,
      [studentId],
    );
    const due = bills.filter((b) => !b.payment && b.status !== '수강종료');
    const { records: _records, canceled: _canceled, ...summary } = attendance;
    return {
      month,
      attendance: summary,
      classes,
      due: due.map((b) => ({
        studentName: b.studentName,
        className: b.className,
        charge: b.expectedCharge,
        discount: b.expectedDiscount,
      })),
      dueTotal: due.reduce((s, b) => s + b.expectedCharge, 0),
      canRequestMakeup:
        options.absencesInMonth >= 2 && options.forAbsenceId !== null,
      absencesInMonth: options.absencesInMonth,
    };
  }

  async teacherDashboard(user: AuthUser) {
    const today = todayKst();
    const month = today.slice(0, 7);
    const from = mondayOf(today);
    const [week, rates, needs] = await Promise.all([
      this.myWeek(user.id, today),
      this.attendanceRates(month, user.id),
      this.attendance.needsMakeup(user, month),
    ]);
    const incoming = await this.dataSource.query(
      `SELECT st.name AS "studentName", to_char(s2.date, 'YYYY-MM-DD') AS date, to_char(s2.start_time, 'HH24:MI') AS "startTime", c2.name AS "className",
         c1.name || ' ' || to_char(s1.date, 'MM/DD') || ' 결석분' AS "fromClass"
       FROM hw2.makeup mk JOIN hw2.attendance a ON a.id = mk.absence_attendance_id JOIN hw2.student st ON st.id = a.student_id
       JOIN hw2.class_session s1 ON s1.id = a.session_id JOIN hw2.class c1 ON c1.id = s1.class_id
       JOIN hw2.class_session s2 ON s2.id = mk.target_session_id JOIN hw2.class c2 ON c2.id = s2.class_id JOIN hw2.teacher t ON t.id = c2.teacher_id
       WHERE mk.status = '확정' AND mk.deleted_at IS NULL AND t.user_id = $1 AND s2.date BETWEEN $2 AND $3
       ORDER BY s2.date`,
      [user.id, from, addDays(from, 6)],
    );
    return {
      today,
      week,
      todaySessions: week.sessions.filter((s) => s.date === today),
      rates,
      needsMakeup: needs,
      incoming,
    };
  }

  /** D17·강사 내 스케줄: 그 주 내 반 수업 (정규·보충·휴강) + 출결 입력 여부 + 보강생 수 */
  async myWeek(teacherUserId: number, anyDate: string) {
    const from = mondayOf(anyDate);
    const to = addDays(from, 6);
    const sessions: {
      id: number;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      kind: string;
      className: string;
      recorded: number;
      makeups: number;
      enrolled: number;
    }[] = await this.dataSource.query(
      `SELECT s.id, to_char(s.date, 'YYYY-MM-DD') AS date, to_char(s.start_time, 'HH24:MI') AS "startTime", to_char(s.end_time, 'HH24:MI') AS "endTime",
           s.status, s.kind, c.name AS "className", s.memo,
           (SELECT count(*) FROM hw2.attendance a WHERE a.session_id = s.id AND a.deleted_at IS NULL)::int AS recorded,
           (SELECT count(*) FROM hw2.makeup mk WHERE mk.target_session_id = s.id AND mk.status = '확정' AND mk.deleted_at IS NULL)::int AS makeups,
           (SELECT count(*) FROM hw2.enrollment e WHERE e.class_id = c.id AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL)::int AS enrolled
         FROM hw2.class_session s JOIN hw2.class c ON c.id = s.class_id JOIN hw2.teacher t ON t.id = c.teacher_id
         WHERE t.user_id = $1 AND s.date BETWEEN $2 AND $3 AND s.deleted_at IS NULL
         ORDER BY s.date, s.start_time`,
      [teacherUserId, from, to],
    );
    return { from, to, sessions };
  }
}

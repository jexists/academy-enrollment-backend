import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { todayKst } from '../../common/time/kst.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { ParentProfile } from '../families/parent-profile.entity.js';
import { PaymentsService } from '../payments/payments.service.js';
import { Teacher } from '../teachers/teacher.entity.js';
import { AccountsService } from '../users/accounts.service.js';
import { AppUser } from '../users/app-user.entity.js';
import type {
  CreateStaffDto,
  UpdateAccountDto,
  UpdateStaffDto,
} from './staff.dto.js';

@Injectable()
export class StaffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accounts: AccountsService,
    private readonly enrollments: EnrollmentsService,
    private readonly payments: PaymentsService,
  ) {}

  // ───────── 직원 계정 (공통5~8, 관리자만) ─────────

  list() {
    return this.dataSource.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active AS "isActive", u.must_change_password AS "mustChangePassword",
         to_char(u.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS "createdOn", t.subject,
         (SELECT to_char(max(h.created_at) AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') FROM hw2.login_history h WHERE h.user_id = u.id AND h.success) AS "lastLogin"
       FROM hw2.app_user u LEFT JOIN hw2.teacher t ON t.user_id = u.id AND t.deleted_at IS NULL
       WHERE u.role IN ('ADMIN', 'TEACHER') AND u.deleted_at IS NULL
       ORDER BY u.role, u.is_active DESC, u.id`,
    );
  }

  /** 직원 만들기 → 임시 비밀번호. 강사면 강사 정보도 같이 (결정22) */
  async create(dto: CreateStaffDto) {
    return this.dataSource.transaction(async (m) => {
      const account = await this.accounts.create(
        m,
        dto.email,
        dto.name.trim(),
        dto.role,
      );
      if (dto.role === 'TEACHER') {
        await m.save(
          m.create(Teacher, {
            userId: account.user.id,
            subject: dto.subject!.trim(),
            hiredAt: dto.hiredAt ?? todayKst(),
          }),
        );
      }
      return {
        id: account.user.id,
        issued: {
          name: dto.name,
          email: account.user.email,
          password: account.password,
        },
      };
    });
  }

  /** 이름 수정·사용 중지/다시 사용 (공통7). 자기 자신은 멈출 수 없다 */
  async update(id: number, actorId: number, dto: UpdateStaffDto) {
    const repo = this.dataSource.getRepository(AppUser);
    const user = await repo.findOneBy({ id });
    if (!user || !['ADMIN', 'TEACHER'].includes(user.role))
      throw new NotFoundException('없는 직원이에요.');
    if (dto.isActive === false && id === actorId)
      throw new BadRequestException('내 계정은 사용 중지할 수 없어요.');
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    await repo.save(user);
    return { ok: true };
  }

  /** 비밀번호 리셋 → 임시 비밀번호, 다음 로그인 때 변경 강제 (공통8) */
  async resetPassword(id: number) {
    return this.dataSource.transaction(async (m) => {
      const user = await m.findOneBy(AppUser, { id });
      if (!user || !['ADMIN', 'TEACHER'].includes(user.role))
        throw new NotFoundException('없는 직원이에요.');
      return {
        name: user.name,
        email: user.email,
        password: await this.accounts.resetPassword(m, user),
      };
    });
  }

  // ───────── 학부모 내 정보·탈퇴 (결정29·32) ─────────

  /** 탈퇴 조건: 자녀 중 수강중·환불요청인 수강과 미납이 없을 것 */
  private async withdrawBlockers(parentUserId: number) {
    const familyId = await this.enrollments.familyOf(parentUserId);
    if (!familyId) return { active: [], unpaid: 0 };
    const active: { studentName: string; className: string; status: string }[] =
      await this.dataSource.query(
        `SELECT s.name AS "studentName", c.name AS "className", e.status FROM hw2.enrollment e JOIN hw2.student s ON s.id = e.student_id JOIN hw2.class c ON c.id = e.class_id
       WHERE s.family_id = $1 AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL`,
        [familyId],
      );
    const bills = await this.payments.bills(todayKst().slice(0, 7), familyId);
    const unpaid = bills
      .filter((b) => !b.payment && b.status !== '수강종료')
      .reduce((s, b) => s + b.expectedCharge, 0);
    return { active, unpaid };
  }

  async account(parentUserId: number) {
    const [me] = await this.dataSource.query(
      `SELECT u.name, u.email, p.relation, p.phone FROM hw2.app_user u LEFT JOIN hw2.parent_profile p ON p.user_id = u.id AND p.deleted_at IS NULL WHERE u.id = $1`,
      [parentUserId],
    );
    return { ...me, blockers: await this.withdrawBlockers(parentUserId) };
  }

  async updateAccount(parentUserId: number, dto: UpdateAccountDto) {
    await this.dataSource.transaction(async (m) => {
      const user = await m.findOneByOrFail(AppUser, { id: parentUserId });
      const profile = await m.findOneBy(ParentProfile, {
        userId: parentUserId,
      });
      if (dto.name) {
        user.name = dto.name.trim();
        await m.save(user);
        if (profile) profile.name = user.name;
      }
      if (profile && dto.phone) profile.phone = dto.phone;
      if (profile) await m.save(profile);
    });
    // 트랜잭션이 끝난 뒤 읽어야 바뀐 값이 보인다 (QA BUG-023 — 안에서 다른 연결로 읽으면 수정 전 값)
    return this.account(parentUserId);
  }

  /**
   * 회원 탈퇴: 계정에 deleted_at만 채워 로그인을 막고 이름·이메일은 백업으로 둔다 (결정29·32).
   * 가족에 계정 있는 다른 보호자가 없으면 그 가족 학생 계정도 같이 탈퇴. 수강·출결·납부 기록은 그대로.
   */
  async withdraw(parentUserId: number) {
    const { active, unpaid } = await this.withdrawBlockers(parentUserId);
    if (active.length || unpaid) {
      const parts = [
        ...(active.length
          ? [
              `수강 중인 반이 있어요 (${active.map((a) => `${a.studentName} ${a.className}${a.status === '환불요청' ? ' 환불 요청 중' : ''}`).join(', ')})`,
            ]
          : []),
        ...(unpaid
          ? [`이번 달 수강료 ${unpaid.toLocaleString('ko-KR')}원이 미납이에요`]
          : []),
      ];
      throw new BadRequestException(`탈퇴할 수 없어요. ${parts.join(' · ')}`);
    }
    const familyId = await this.enrollments.familyOf(parentUserId);
    return this.dataSource.transaction(async (m) => {
      const user = await m.findOneByOrFail(AppUser, { id: parentUserId });
      await m.softRemove(user);
      if (familyId) {
        const [{ others }] = await m.query(
          `SELECT count(*)::int AS others FROM hw2.parent_profile p JOIN hw2.app_user u ON u.id = p.user_id
           WHERE p.family_id = $1 AND u.deleted_at IS NULL AND u.id <> $2`,
          [familyId, parentUserId],
        );
        if (others === 0) {
          const students: { user_id: number }[] = await m.query(
            `SELECT user_id FROM hw2.student WHERE family_id = $1 AND deleted_at IS NULL`,
            [familyId],
          );
          for (const s of students) {
            const account = await m.findOneBy(AppUser, { id: s.user_id });
            if (account) await m.softRemove(account);
          }
        }
      }
      return { ok: true };
    });
  }
}

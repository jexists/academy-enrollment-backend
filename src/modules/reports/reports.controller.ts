import {
  Controller,
  ForbiddenException,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import { todayKst } from '../../common/time/kst.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { ReportsService } from './reports.service.js';

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /** D19 학부모 자녀 요약 (자기 가족만) */
  @Get('parent/summary')
  @Auth('PARENT')
  async parentSummary(
    @CurrentUser() user: AuthUser,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    await this.enrollments.assertChild(user.id, studentId);
    const familyId = await this.enrollments.familyOf(user.id);
    if (!familyId)
      throw new ForbiddenException('우리 가족 자녀만 볼 수 있어요.');
    return this.reports.parentSummary(studentId, familyId);
  }

  /** 관리자 대시보드: 수입·학생 수·반 정원·대기 수·C13~15 */
  @Get('admin/dashboard')
  @Auth('ADMIN')
  admin() {
    return this.reports.adminDashboard();
  }

  /** 강사 대시보드: 오늘·이번 주 내 수업, 내 반 학생 출석률, 보강 필요, 들어오는 보강생 */
  @Get('staff/dashboard')
  @Auth('TEACHER')
  teacher(@CurrentUser() user: AuthUser) {
    return this.reports.teacherDashboard(user);
  }

  /** 강사 내 스케줄 (주간) */
  @Get('staff/my-week')
  @Auth('TEACHER')
  myWeek(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.reports.myWeek(
      user.id,
      /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : todayKst(),
    );
  }
}

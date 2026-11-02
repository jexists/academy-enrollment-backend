import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import { todayKst } from '../../common/time/kst.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import {
  CancelSessionDto,
  ExtraSessionDto,
  MakeupRequestDto,
  SaveAttendanceDto,
} from './attendance.dto.js';
import { AttendanceService } from './attendance.service.js';

const month = (value?: string) =>
  /^\d{4}-\d{2}$/.test(value ?? '') ? value! : todayKst().slice(0, 7);
const date = (value?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value! : todayKst();

/** 직원(원장·강사): 수업일·출결·보강 */
@Controller('staff')
@Auth('ADMIN', 'TEACHER')
export class StaffAttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser, @Query('date') day?: string) {
    return this.service.sessionsOn(user, date(day));
  }

  @Get('sessions/:id/roster')
  roster(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.roster(user, id);
  }

  @Put('sessions/:id/attendance')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveAttendanceDto,
  ) {
    return this.service.saveAttendance(user, id, dto);
  }

  @Get('makeups')
  makeups(@CurrentUser() user: AuthUser) {
    return this.service.makeups(user);
  }

  @Get('makeups/needed')
  needed(@CurrentUser() user: AuthUser) {
    return this.service.needsMakeup(user);
  }
}

/** 원장만: 휴강·보충, 보강 신청 대신·확정·거절 (결정14·18·35) */
@Controller('admin')
@Auth('ADMIN')
export class AdminSessionsController {
  constructor(private readonly service: AttendanceService) {}

  @Post('sessions/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelSessionDto) {
    return this.service.cancelSession(id, dto);
  }

  @Post('classes/:id/extra-sessions')
  extra(@Param('id', ParseIntPipe) id: number, @Body() dto: ExtraSessionDto) {
    return this.service.addExtraSession(id, dto);
  }

  @Get('makeups/options')
  options(@Query('studentId', ParseIntPipe) studentId: number) {
    return this.service.makeupOptions(studentId);
  }

  @Post('makeups')
  request(@Body() dto: MakeupRequestDto) {
    return this.service.requestMakeup(
      dto.absenceAttendanceId,
      dto.targetSessionId,
    );
  }

  @Post('makeups/:id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decideMakeup(id, user.id, '확정');
  }

  @Post('makeups/:id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.decideMakeup(id, user.id, '거절');
  }

  @Get('students/:id/attendance')
  studentAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') m?: string,
  ) {
    return this.service.monthAttendance(id, month(m));
  }
}

/** 학부모: 자녀 출석·보강 신청 (자기 가족만) */
@Controller('parent')
@Auth('PARENT')
export class ParentAttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  @Get('attendance')
  async attendance(
    @CurrentUser() user: AuthUser,
    @Query('studentId', ParseIntPipe) studentId: number,
    @Query('month') m?: string,
  ) {
    await this.enrollments.assertChild(user.id, studentId);
    return this.service.monthAttendance(studentId, month(m));
  }

  @Get('makeups/options')
  async options(
    @CurrentUser() user: AuthUser,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    await this.enrollments.assertChild(user.id, studentId);
    return this.service.makeupOptions(studentId);
  }

  @Post('makeups')
  async request(@CurrentUser() user: AuthUser, @Body() dto: MakeupRequestDto) {
    await this.enrollments.assertChild(
      user.id,
      await this.service.studentOfAttendance(dto.absenceAttendanceId),
    );
    return this.service.requestMakeup(
      dto.absenceAttendanceId,
      dto.targetSessionId,
    );
  }
}

/** 학생: 내 스케줄·내 출석 (보기만, 결정16) */
@Controller('student')
@Auth('STUDENT')
export class StudentViewController {
  constructor(private readonly service: AttendanceService) {}

  @Get('schedule')
  async schedule(@CurrentUser() user: AuthUser, @Query('date') day?: string) {
    return this.service.weekSchedule(
      await this.service.studentIdOfUser(user.id),
      date(day),
    );
  }

  @Get('attendance')
  async attendance(@CurrentUser() user: AuthUser, @Query('month') m?: string) {
    return this.service.monthAttendance(
      await this.service.studentIdOfUser(user.id),
      month(m),
    );
  }
}

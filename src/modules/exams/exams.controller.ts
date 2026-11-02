import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { SaveScoresDto } from './exams.dto.js';
import { ExamsService } from './exams.service.js';

@Controller()
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly enrollments: EnrollmentsService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get('staff/scores/classes')
  @Auth('ADMIN', 'TEACHER')
  classes(@CurrentUser() user: AuthUser) {
    return this.exams.myClasses(user);
  }

  @Get('staff/scores')
  @Auth('ADMIN', 'TEACHER')
  sheet(
    @CurrentUser() user: AuthUser,
    @Query('classId', ParseIntPipe) classId: number,
    @Query('examName') examName?: string,
    @Query('examDate') examDate?: string,
  ) {
    return this.exams.sheet(user, classId, examName, examDate);
  }

  @Post('staff/scores')
  @Auth('ADMIN', 'TEACHER')
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveScoresDto) {
    return this.exams.save(user, dto);
  }

  @Get('admin/students/:id/scores')
  @Auth('ADMIN')
  ofStudent(@Param('id', ParseIntPipe) id: number) {
    return this.exams.ofStudent(id);
  }

  @Get('parent/scores')
  @Auth('PARENT')
  async parent(
    @CurrentUser() user: AuthUser,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    await this.enrollments.assertChild(user.id, studentId);
    return this.exams.ofStudent(studentId);
  }

  @Get('student/scores')
  @Auth('STUDENT')
  async student(@CurrentUser() user: AuthUser) {
    return this.exams.ofStudent(await this.attendance.studentIdOfUser(user.id));
  }
}

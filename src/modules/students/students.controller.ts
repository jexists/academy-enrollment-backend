import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import {
  CounselNoteDto,
  CreateSchoolDto,
  GradeAdjustmentDto,
  RegisterStudentDto,
  SchoolChangeDto,
} from './students.dto.js';
import { StudentsService } from './students.service.js';

/** 학생 등록·학적·상담 메모 — 원장만 (결정6·18) */
@Controller('admin')
@Auth('ADMIN')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get('students')
  list(@Query('q') q?: string) {
    return this.students.list(q);
  }

  @Get('students/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.students.detail(id);
  }

  @Post('students')
  register(@Body() dto: RegisterStudentDto) {
    return this.students.register(dto);
  }

  @Post('students/:id/school-history')
  changeSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SchoolChangeDto,
  ) {
    return this.students.changeSchool(id, dto);
  }

  @Post('students/:id/grade-adjustments')
  adjustGrade(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: GradeAdjustmentDto,
  ) {
    return this.students.adjustGrade(id, user.id, dto);
  }

  @Post('students/:id/notes')
  addNote(@Param('id', ParseIntPipe) id: number, @Body() dto: CounselNoteDto) {
    return this.students.addNote(id, dto);
  }

  @Post('students/:id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.students.resetStudentPassword(id);
  }

  @Get('schools')
  schools(@Query('q') q?: string) {
    return this.students.schools(q);
  }

  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.students.createSchool(dto);
  }

  @Get('families')
  families(@Query('q') q?: string) {
    return this.students.families(q);
  }
}

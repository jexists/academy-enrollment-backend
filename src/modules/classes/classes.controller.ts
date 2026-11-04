import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { todayKst } from '../../common/time/kst.js';
import {
  CreateClassDto,
  CreateTeacherDto,
  GenerateSessionsDto,
  UpdateClassDto,
  UpdateTeacherProfileDto,
} from './classes.dto.js';
import { ClassesService } from './classes.service.js';

/** 반·시간표·강사 관리 — 원장만 (결정18) */
@Controller('admin')
@Auth('ADMIN')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('classes')
  list() {
    return this.classes.list();
  }

  @Get('classes/:id')
  detail(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') month?: string,
  ) {
    return this.classes.detail(
      id,
      /^\d{4}-\d{2}$/.test(month ?? '') ? month! : todayKst().slice(0, 7),
    );
  }

  @Post('classes')
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Patch('classes/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClassDto) {
    return this.classes.update(id, dto);
  }

  @Post('classes/:id/sessions/generate')
  generate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateSessionsDto,
  ) {
    return this.classes.generateMonth(id, dto.yearMonth);
  }

  @Get('teachers')
  teachers() {
    return this.classes.teachers();
  }

  @Get('teachers/:id/slots')
  teacherSlots(@Param('id', ParseIntPipe) id: number) {
    return this.classes.teacherSlots(id);
  }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.classes.createTeacher(dto);
  }

  @Patch('teachers/:id')
  updateTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.classes.updateTeacherProfile(id, dto);
  }
}

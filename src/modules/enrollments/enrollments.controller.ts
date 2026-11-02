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
import { ApplyDto, PhoneEnrollDto } from './enrollments.dto.js';
import { EnrollmentsService } from './enrollments.service.js';

/** 학부모: 자녀·반 보기, 신청, 신청 취소 (자기 가족만) */
@Controller('parent')
@Auth('PARENT')
export class ParentEnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get('children')
  children(@CurrentUser() user: AuthUser) {
    return this.service.children(user.id);
  }

  @Get('classes')
  classes(
    @CurrentUser() user: AuthUser,
    @Query('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.service.classesFor(user.id, studentId);
  }

  @Get('enrollments')
  list(@CurrentUser() user: AuthUser) {
    return this.service.parentEnrollments(user.id);
  }

  @Post('enrollments')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyDto) {
    return this.service.apply(user.id, dto.studentId, dto.classId);
  }

  @Post('enrollments/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(user.id, id);
  }
}

/** 관리자: 신청 승인·거절·전화 신청 (결정7·18·20) */
@Controller('admin/enrollments')
@Auth('ADMIN')
export class AdminEnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.adminList(status);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approve(id, user.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.reject(id, user.id);
  }

  @Post('phone')
  phone(@CurrentUser() user: AuthUser, @Body() dto: PhoneEnrollDto) {
    return this.service.phone(user.id, dto);
  }
}

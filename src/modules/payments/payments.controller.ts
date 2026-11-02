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
import { todayKst } from '../../common/time/kst.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { FinishDto, MarkPaidDto } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

const month = (v?: string) =>
  /^\d{4}-\d{2}$/.test(v ?? '') ? v! : todayKst().slice(0, 7);
const day = (v?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v! : todayKst();

/** 회계·환불 — 원장만 (결정18) */
@Controller('admin')
@Auth('ADMIN')
export class AdminPaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('payments')
  bills(@Query('month') m?: string) {
    return this.service.bills(month(m));
  }

  @Post('payments')
  markPaid(@Body() dto: MarkPaidDto) {
    return this.service.markPaid(dto);
  }

  @Get('enrollments/:id/refund-preview')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.preview(id, day(endDate));
  }

  @Post('enrollments/:id/finish')
  @HttpCode(200)
  finish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinishDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.finish(id, dto.endDate, user.id);
  }
}

/** 학부모: 결제 화면, 환불 신청 (자기 가족만) */
@Controller('parent')
@Auth('PARENT')
export class ParentPaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  @Get('payments')
  payments(@CurrentUser() user: AuthUser) {
    return this.service.parentPayments(user.id);
  }

  @Get('enrollments/:id/refund-preview')
  async preview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.enrollments.ownEnrollment(user.id, id);
    return this.service.preview(id, todayKst());
  }

  @Post('enrollments/:id/refund-request')
  @HttpCode(200)
  request(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.requestRefund(user.id, id);
  }
}

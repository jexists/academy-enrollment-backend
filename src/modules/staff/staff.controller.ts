import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import {
  CreateStaffDto,
  UpdateAccountDto,
  UpdateStaffDto,
} from './staff.dto.js';
import { StaffService } from './staff.service.js';

/** 직원 계정 관리 — 관리자만 (공통6) */
@Controller('admin/staff')
@Auth('ADMIN')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(id, user.id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  reset(@Param('id', ParseIntPipe) id: number) {
    return this.staff.resetPassword(id);
  }
}

/** 학부모 내 정보·회원 탈퇴 */
@Controller('parent/account')
@Auth('PARENT')
export class ParentAccountController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  account(@CurrentUser() user: AuthUser) {
    return this.staff.account(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.staff.updateAccount(user.id, dto);
  }

  @Post('withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser) {
    return this.staff.withdraw(user.id);
  }
}

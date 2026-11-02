import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { AuditService } from './audit.service.js';

class RestoreDto {
  @IsString()
  table: string;

  @Type(() => Number)
  @IsInt()
  rowId: number;
}

/** 변경 기록 · 로그인 기록 · 삭제 항목 — 관리자만 */
@Controller('admin')
@Auth('ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('audit/changes')
  changes(@Query('action') action?: string) {
    return this.audit.changes(action);
  }

  @Get('audit/logins')
  logins() {
    return this.audit.logins();
  }

  @Get('audit/deleted')
  deleted() {
    return this.audit.deleted();
  }

  @Post('audit/restore')
  @HttpCode(200)
  restore(@Body() dto: RestoreDto) {
    return this.audit.restore(dto.table, dto.rowId);
  }

  @Delete('notes/:id')
  deleteNote(@Param('id', ParseIntPipe) id: number) {
    return this.audit.deleteNote(id);
  }
}

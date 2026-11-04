import { Controller, Get } from '@nestjs/common';
import { PublicService } from './public.service.js';

@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  /** 첫 화면 반 목록 (로그인 없이) */
  @Get('classes')
  classes() {
    return this.service.classes();
  }

  /** 강사진 화면 (로그인 없이) */
  @Get('teachers')
  teachers() {
    return this.service.teachers();
  }
}

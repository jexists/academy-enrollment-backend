import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth.types.js';
import { currentContext } from '../../common/context/request-context.js';
import {
  AllowTempPassword,
  Auth,
  CurrentUser,
} from '../../common/decorators/auth.decorator.js';
import {
  ChangePasswordDto,
  DemoLoginDto,
  LoginDto,
  type AppKind,
  SignupDto,
} from './auth.dto.js';
import { AuthService, type ClientInfo } from './auth.service.js';

function client(req: Request): ClientInfo {
  return {
    ip: currentContext().ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 로그인 시도는 1분에 20번까지 */
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, client(req));
  }

  @Post('signup')
  @UseGuards(ThrottlerGuard)
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.auth.signup(dto, client(req));
  }

  @Get('demo-accounts')
  demoAccounts(@Query('app') app: AppKind) {
    return this.auth.demoAccounts(app === 'admin' ? 'admin' : 'web');
  }

  @Post('demo-login')
  @HttpCode(200)
  demoLogin(@Body() dto: DemoLoginDto, @Req() req: Request) {
    return this.auth.demoLogin(dto.email, dto.app, client(req));
  }

  @Get('me')
  @Auth()
  @AllowTempPassword()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post('password')
  @HttpCode(200)
  @Auth()
  @AllowTempPassword()
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto);
  }
}

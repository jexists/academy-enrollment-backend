import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsService } from './accounts.service.js';
import { AppUser } from './app-user.entity.js';
import { LoginHistory } from './login-history.entity.js';

/** 계정 저장소는 AuthGuard가 어디서나 쓰므로 전역으로 둔다 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppUser, LoginHistory])],
  providers: [AccountsService],
  exports: [TypeOrmModule, AccountsService],
})
export class UsersModule {}

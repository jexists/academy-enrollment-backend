import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RequestContextMiddleware } from './common/context/request-context.middleware.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module.js';
import { EntitiesModule } from './modules/entities.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { SeedModule } from './modules/seed/seed.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 로그인 시도 제한: 1분에 20번
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    DatabaseModule,
    AuditModule,
    UsersModule,
    EntitiesModule,
    HealthModule,
    AuthModule,
    PublicModule,
    StudentsModule,
    ClassesModule,
    EnrollmentsModule,
    // 원장 계정(AuthModule)이 먼저 생긴 뒤 데모 데이터를 넣는다
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

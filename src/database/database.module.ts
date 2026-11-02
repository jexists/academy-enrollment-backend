import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppEnv } from '../config/env.js';
import { DB_SCHEMA } from './database.constants.js';
import { DatabaseInitService } from './database-init.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL', { infer: true }),
        schema: DB_SCHEMA,
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: false,
        // 원격 DB라 연결을 새로 맺는 비용이 크다. 연결을 오래 살려 두고 다시 쓴다.
        extra: { max: 10, idleTimeoutMillis: 5 * 60_000, keepAlive: true },
      }),
    }),
  ],
  providers: [DatabaseInitService],
})
export class DatabaseModule {}

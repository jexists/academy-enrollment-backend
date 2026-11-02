import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity.js';
import { AuditSubscriber } from './audit.subscriber.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditSubscriber],
  exports: [TypeOrmModule],
})
export class AuditModule {}

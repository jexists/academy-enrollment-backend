import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditSubscriber } from './audit.subscriber.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditSubscriber, AuditService],
  exports: [TypeOrmModule],
})
export class AuditModule {}

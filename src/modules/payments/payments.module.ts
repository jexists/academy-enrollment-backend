import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import {
  AdminPaymentsController,
  ParentPaymentsController,
} from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [AdminPaymentsController, ParentPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

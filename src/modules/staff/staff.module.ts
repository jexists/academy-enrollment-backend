import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import {
  ParentAccountController,
  StaffController,
} from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [EnrollmentsModule, PaymentsModule],
  controllers: [StaffController, ParentAccountController],
  providers: [StaffService],
})
export class StaffModule {}

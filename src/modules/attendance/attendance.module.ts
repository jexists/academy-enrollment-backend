import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import {
  AdminSessionsController,
  ParentAttendanceController,
  StaffAttendanceController,
  StudentViewController,
} from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [
    StaffAttendanceController,
    AdminSessionsController,
    ParentAttendanceController,
    StudentViewController,
  ],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';

@Module({
  imports: [EnrollmentsModule, AttendanceModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}

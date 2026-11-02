import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module.js';
import {
  AdminEnrollmentsController,
  ParentEnrollmentsController,
} from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';

@Module({
  imports: [StudentsModule],
  controllers: [ParentEnrollmentsController, AdminEnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}

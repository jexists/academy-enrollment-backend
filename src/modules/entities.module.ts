import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './attendance/attendance.entity.js';
import { Makeup } from './attendance/makeup.entity.js';
import { Enrollment } from './enrollments/enrollment.entity.js';
import { ExamScore } from './exams/exam-score.entity.js';
import { TuitionPayment } from './payments/tuition-payment.entity.js';
import { ClassSchedule } from './classes/class-schedule.entity.js';
import { ClassSession } from './classes/class-session.entity.js';
import { ClassEntity } from './classes/class.entity.js';
import { CounselNote } from './families/counsel-note.entity.js';
import { Family } from './families/family.entity.js';
import { ParentProfile } from './families/parent-profile.entity.js';
import { School } from './students/school.entity.js';
import { StudentGradeAdjustment } from './students/student-grade-adjustment.entity.js';
import { StudentSchoolHistory } from './students/student-school-history.entity.js';
import { Student } from './students/student.entity.js';
import { Teacher } from './teachers/teacher.entity.js';

/** 업무 엔티티 저장소를 한곳에서 등록한다 (도메인 모듈이 생기면 각자 가져다 쓴다) */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Family,
      ParentProfile,
      CounselNote,
      Teacher,
      Student,
      School,
      StudentSchoolHistory,
      StudentGradeAdjustment,
      ClassEntity,
      ClassSchedule,
      ClassSession,
      Enrollment,
      Attendance,
      Makeup,
      TuitionPayment,
      ExamScore,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class EntitiesModule {}

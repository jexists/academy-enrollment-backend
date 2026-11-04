import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { careerLines } from '../teachers/teacher-profile.js';

export interface PublicClass {
  id: number;
  name: string;
  targetGrade: number;
  teacherId: number;
  teacherName: string;
  monthlyFee: number;
  capacity: number;
  enrolled: number;
  remaining: number;
  intro: string | null;
  schedules: { weekday: number; startTime: string; endTime: string }[];
}

export interface PublicTeacher {
  id: number;
  name: string;
  subject: string;
  hiredAt: string;
  bio: string | null;
  career: string[];
  classes: {
    id: number;
    name: string;
    targetGrade: number;
    schedules: { weekday: number; startTime: string; endTime: string }[];
  }[];
}

/** 로그인 없이 보는 정보 (결정17): 개설 반·월 수강료·요일·시간·남은 자리 */
@Injectable()
export class PublicService {
  constructor(private readonly dataSource: DataSource) {}

  async classes(): Promise<PublicClass[]> {
    // 현재 인원 = 진행 중인 수강 수 (저장하지 않고 센다 — rules.md)
    const rows: {
      id: number;
      name: string;
      target_grade: number;
      teacher_id: number;
      teacher_name: string;
      monthly_fee: number;
      capacity: number;
      intro: string | null;
      enrolled: string;
      schedules: { weekday: number; startTime: string; endTime: string }[];
    }[] = await this.dataSource.query(`
      SELECT c.id, c.name, c.target_grade, c.teacher_id, u.name AS teacher_name, c.monthly_fee, c.capacity, c.intro,
        (SELECT count(*) FROM hw2.enrollment e
          WHERE e.class_id = c.id AND e.status IN ('수강중', '환불요청') AND e.deleted_at IS NULL) AS enrolled,
        COALESCE((SELECT json_agg(json_build_object(
            'weekday', s.weekday, 'startTime', to_char(s.start_time, 'HH24:MI'), 'endTime', to_char(s.end_time, 'HH24:MI'))
            ORDER BY s.weekday)
          FROM hw2.class_schedule s WHERE s.class_id = c.id AND s.deleted_at IS NULL), '[]') AS schedules
      FROM hw2.class c
      JOIN hw2.teacher t ON t.id = c.teacher_id
      JOIN hw2.app_user u ON u.id = t.user_id
      WHERE c.is_active AND c.deleted_at IS NULL
      ORDER BY c.target_grade, c.name`);
    return rows.map((row) => {
      const enrolled = Number(row.enrolled);
      return {
        id: row.id,
        name: row.name,
        targetGrade: row.target_grade,
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        monthlyFee: row.monthly_fee,
        capacity: row.capacity,
        enrolled,
        remaining: Math.max(0, row.capacity - enrolled),
        intro: row.intro,
        schedules: row.schedules,
      };
    });
  }

  /** 강사진 (결정41): 사용 중인 강사만. 이메일 같은 계정 정보는 내보내지 않는다 */
  async teachers(): Promise<PublicTeacher[]> {
    const rows: (Omit<PublicTeacher, 'career'> & { career: string | null })[] =
      await this.dataSource.query(`
      SELECT t.id, u.name, t.subject, to_char(t.hired_at, 'YYYY-MM-DD') AS "hiredAt", t.bio, t.career,
        COALESCE((SELECT json_agg(json_build_object(
            'id', c.id, 'name', c.name, 'targetGrade', c.target_grade,
            'schedules', COALESCE((SELECT json_agg(json_build_object(
                'weekday', s.weekday, 'startTime', to_char(s.start_time, 'HH24:MI'), 'endTime', to_char(s.end_time, 'HH24:MI'))
                ORDER BY s.weekday)
              FROM hw2.class_schedule s WHERE s.class_id = c.id AND s.deleted_at IS NULL), '[]'))
            ORDER BY c.target_grade, c.name)
          FROM hw2.class c WHERE c.teacher_id = t.id AND c.is_active AND c.deleted_at IS NULL), '[]') AS classes
      FROM hw2.teacher t
      JOIN hw2.app_user u ON u.id = t.user_id
      WHERE u.is_active AND u.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY t.hired_at, t.id`);
    return rows.map((row) => ({ ...row, career: careerLines(row.career) }));
  }
}

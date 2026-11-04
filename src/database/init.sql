-- 한빛수학 과제용 스키마. 1주차 테이블과 섞이지 않게 hw2에만 만든다. (docs/erd.md 기준)
-- 서버를 켤 때마다 실행되므로 모두 IF NOT EXISTS. 제약 이름은 AllExceptionsFilter의 안내 문구와 짝을 이룬다.
-- 공통 칼럼: created_at, updated_at, created_by, updated_by, deleted_at (soft delete)
-- 상태값은 한국어 글자 + CHECK로 막는다 (ENUM 타입 대신 — 값 추가가 쉽고 화면 글자와 같다)
CREATE SCHEMA IF NOT EXISTS hw2;
SET search_path TO hw2;

-- ───────── 계정과 사람 ─────────
CREATE TABLE IF NOT EXISTS app_user (
  id                   serial PRIMARY KEY,
  email                varchar(120) NOT NULL,
  password_hash        varchar(100) NOT NULL,
  name                 varchar(40)  NOT NULL,
  role                 varchar(10)  NOT NULL CONSTRAINT app_user_role_check CHECK (role IN ('PARENT', 'STUDENT', 'TEACHER', 'ADMIN')),
  is_active            boolean      NOT NULL DEFAULT true,
  must_change_password boolean      NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 탈퇴한(지운) 계정의 이메일로 다시 가입할 수 있게 살아 있는 행에만 UQ
CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_key ON app_user (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS family (
  id   serial PRIMARY KEY,
  name varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS parent_profile (
  id        serial PRIMARY KEY,
  user_id   int REFERENCES app_user(id),          -- 이메일이 없는 보호자는 계정 없이 null (결정33)
  family_id int REFERENCES family(id),            -- 직접 가입 후 관리자가 연결하기 전 null
  relation  varchar(2)  NOT NULL CONSTRAINT parent_profile_relation_check CHECK (relation IN ('부', '모')),
  name      varchar(40) NOT NULL,
  phone     varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS parent_profile_user_key ON parent_profile (user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS teacher (
  id       serial PRIMARY KEY,
  user_id  int NOT NULL REFERENCES app_user(id),
  subject  varchar(40) NOT NULL,
  hired_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_user_key ON teacher (user_id) WHERE deleted_at IS NULL;
-- 강사 소개 (결정41): 보여 주기만 하는 글이라 칸 두 개. 이력은 줄바꿈으로 나눈 text (최대 6줄은 백엔드가 검사)
ALTER TABLE teacher ADD COLUMN IF NOT EXISTS bio text CONSTRAINT teacher_bio_check CHECK (char_length(bio) <= 300);
ALTER TABLE teacher ADD COLUMN IF NOT EXISTS career text CONSTRAINT teacher_career_check CHECK (char_length(career) <= 400);

CREATE TABLE IF NOT EXISTS student (
  id            serial PRIMARY KEY,
  user_id       int  NOT NULL REFERENCES app_user(id),  -- 등록 때 학생 계정도 같이 만든다
  family_id     int  NOT NULL REFERENCES family(id),
  name          varchar(40) NOT NULL,
  birth_date    date NOT NULL,
  registered_at date NOT NULL DEFAULT current_date,     -- 형제 순번(등록순) 기준
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS student_user_key ON student (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school (
  id     serial PRIMARY KEY,
  name   varchar(40) NOT NULL,
  level  varchar(1)  NOT NULL CONSTRAINT school_level_check CHECK (level IN ('중', '고')),
  region varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 같은 이름 학교가 지역마다 있어서 (이름, 지역)으로 하나
CREATE UNIQUE INDEX IF NOT EXISTS school_name_region_key ON school (name, region) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS student_school_history (
  id             serial PRIMARY KEY,
  student_id     int  NOT NULL REFERENCES student(id),
  school_id      int  NOT NULL REFERENCES school(id),
  change_type    varchar(4) NOT NULL CONSTRAINT student_school_history_change_type_check CHECK (change_type IN ('처음등록', '전학', '진학')),
  entered_on     date NOT NULL,   -- 학교급 입학일 (학년 계산)
  effective_from date NOT NULL,   -- 이 학교로 바뀐 날
  memo           varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS student_grade_adjustment (
  id             serial PRIMARY KEY,
  student_id     int  NOT NULL REFERENCES student(id),
  delta          int  NOT NULL CONSTRAINT student_grade_adjustment_delta_check CHECK (delta <> 0),
  reason         varchar(200) NOT NULL,
  effective_from date NOT NULL,
  staff_id       int  NOT NULL REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS counsel_note (
  id                serial PRIMARY KEY,
  family_id         int  NOT NULL REFERENCES family(id),
  student_id        int  REFERENCES student(id),         -- 학생 메모면
  parent_profile_id int  REFERENCES parent_profile(id),  -- 학부모 메모면 (둘 다 비우면 가족 메모)
  category          varchar(4) NOT NULL CONSTRAINT counsel_note_category_check CHECK (category IN ('상담', '학습', '생활', '연락', '결제', '기타')),
  noted_on          date NOT NULL DEFAULT current_date,
  content           text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);

-- ───────── 반과 수업 ─────────
CREATE TABLE IF NOT EXISTS class (
  id           serial PRIMARY KEY,
  name         varchar(40) NOT NULL,
  target_grade int NOT NULL CONSTRAINT class_target_grade_check CHECK (target_grade BETWEEN 7 AND 12),
  teacher_id   int NOT NULL REFERENCES teacher(id),
  capacity     int NOT NULL DEFAULT 8 CONSTRAINT class_capacity_check CHECK (capacity > 0),
  monthly_fee  int NOT NULL CONSTRAINT class_monthly_fee_check CHECK (monthly_fee >= 0),
  intro        varchar(200),      -- 첫 화면 소개 한 줄
  is_active    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS class_name_key ON class (name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS class_schedule (
  id         serial PRIMARY KEY,
  class_id   int NOT NULL REFERENCES class(id),
  weekday    int NOT NULL CONSTRAINT class_schedule_weekday_check CHECK (weekday BETWEEN 0 AND 6),  -- 0 = 일요일
  start_time time NOT NULL,
  end_time   time NOT NULL,
  CONSTRAINT class_schedule_time_check CHECK (end_time > start_time),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS class_schedule_class_weekday_key ON class_schedule (class_id, weekday) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS class_session (
  id                  serial PRIMARY KEY,
  class_id            int  NOT NULL REFERENCES class(id),
  date                date NOT NULL,
  start_time          time NOT NULL,
  end_time            time NOT NULL,
  status              varchar(2) NOT NULL DEFAULT '정상' CONSTRAINT class_session_status_check CHECK (status IN ('정상', '휴강')),
  kind                varchar(2) NOT NULL DEFAULT '정규' CONSTRAINT class_session_kind_check CHECK (kind IN ('정규', '보충')),
  replaces_session_id int  REFERENCES class_session(id),  -- 휴강을 대신하는 보충이면 원래 수업
  memo                varchar(200),
  CONSTRAINT class_session_time_check CHECK (end_time > start_time),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS class_session_class_date_time_key ON class_session (class_id, date, start_time) WHERE deleted_at IS NULL;

-- ───────── 수강·출결·보강 ─────────
CREATE TABLE IF NOT EXISTS enrollment (
  id                   serial PRIMARY KEY,
  student_id           int  NOT NULL REFERENCES student(id),
  class_id             int  NOT NULL REFERENCES class(id),
  status               varchar(4) NOT NULL DEFAULT '신청됨' CONSTRAINT enrollment_status_check CHECK (status IN ('신청됨', '수강중', '환불요청', '수강종료', '거절', '취소')),
  start_date           date NOT NULL,
  end_date             date,                                   -- 그만둔 날
  refund_amount        int CONSTRAINT enrollment_refund_amount_check CHECK (refund_amount >= 0),  -- 수강종료 때 확정
  applied_by_parent_id int REFERENCES parent_profile(id),      -- 학부모가 신청했으면
  created_by_staff_id  int REFERENCES app_user(id),            -- 전화 신청을 직원이 대신 등록했으면
  decided_by           int REFERENCES app_user(id),
  decided_at           timestamptz,
  CONSTRAINT enrollment_dates_check CHECK (end_date IS NULL OR end_date >= start_date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 같은 반에 진행 중인 수강은 하나만 (B6)
CREATE UNIQUE INDEX IF NOT EXISTS enrollment_active_key ON enrollment (student_id, class_id)
  WHERE status IN ('신청됨', '수강중', '환불요청') AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS attendance (
  id          serial PRIMARY KEY,
  session_id  int NOT NULL REFERENCES class_session(id),
  student_id  int NOT NULL REFERENCES student(id),
  attend_type varchar(2) NOT NULL DEFAULT '수강' CONSTRAINT attendance_attend_type_check CHECK (attend_type IN ('수강', '보강')),
  makeup_id   int,   -- 보강이면 어떤 보강인지 (FK는 makeup을 만든 뒤 아래에서)
  status      varchar(2) NOT NULL CONSTRAINT attendance_status_check CHECK (status IN ('출석', '지각', '결석')),
  arrived_at  time,  -- 도착 시각 (결석이면 null)
  recorded_by int REFERENCES app_user(id),
  CONSTRAINT attendance_makeup_check CHECK ((attend_type = '보강') = (makeup_id IS NOT NULL)),
  CONSTRAINT attendance_arrived_check CHECK (status <> '결석' OR arrived_at IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 학생 + 수업 하나에 출결 하나 (B10)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_key ON attendance (session_id, student_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS makeup (
  id                    serial PRIMARY KEY,
  absence_attendance_id int NOT NULL REFERENCES attendance(id),
  target_session_id     int NOT NULL REFERENCES class_session(id),
  status                varchar(2) NOT NULL DEFAULT '신청' CONSTRAINT makeup_status_check CHECK (status IN ('신청', '확정', '거절')),
  decided_by            int REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 결석 1건에 보강은 하나 (거절된 건 다시 신청 가능)
CREATE UNIQUE INDEX IF NOT EXISTS makeup_absence_key ON makeup (absence_attendance_id) WHERE status <> '거절' AND deleted_at IS NULL;

DO $$ BEGIN
  ALTER TABLE attendance ADD CONSTRAINT attendance_makeup_fk FOREIGN KEY (makeup_id) REFERENCES makeup(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 보강 1건 = 출결 1줄
CREATE UNIQUE INDEX IF NOT EXISTS attendance_makeup_key ON attendance (makeup_id) WHERE makeup_id IS NOT NULL AND deleted_at IS NULL;

-- ───────── 돈·성적 ─────────
CREATE TABLE IF NOT EXISTS tuition_payment (
  id              serial PRIMARY KEY,
  enrollment_id   int  NOT NULL REFERENCES enrollment(id),
  year_month      char(7) NOT NULL CONSTRAINT tuition_payment_year_month_check CHECK (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  list_price      int  NOT NULL CONSTRAINT tuition_payment_list_price_check CHECK (list_price >= 0),
  discount_amount int  NOT NULL DEFAULT 0,
  discount_type   varchar(2) NOT NULL DEFAULT '없음' CONSTRAINT tuition_payment_discount_type_check CHECK (discount_type IN ('없음', '형제', '기타')),
  paid_amount     int  NOT NULL,
  paid_at         date NOT NULL,
  memo            varchar(200),
  CONSTRAINT tuition_payment_discount_range_check CHECK (discount_amount BETWEEN 0 AND list_price),
  CONSTRAINT tuition_payment_paid_amount_check CHECK (paid_amount = list_price - discount_amount),
  CONSTRAINT tuition_payment_discount_none_check CHECK ((discount_type = '없음') = (discount_amount = 0)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);
-- 수강 하나에 한 달 납부는 하나 (B12) — 행이 있으면 납부, 없으면 미납
CREATE UNIQUE INDEX IF NOT EXISTS tuition_payment_month_key ON tuition_payment (enrollment_id, year_month) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS exam_score (
  id         serial PRIMARY KEY,
  student_id int  NOT NULL REFERENCES student(id),
  exam_name  varchar(40) NOT NULL,
  exam_date  date NOT NULL,
  score      int  NOT NULL CONSTRAINT exam_score_score_check CHECK (score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by int REFERENCES app_user(id),
  updated_by int REFERENCES app_user(id),
  deleted_at timestamptz
);

-- ───────── 기록 (쌓기만, 수정·삭제 없음) ─────────
CREATE TABLE IF NOT EXISTS login_history (
  id         serial PRIMARY KEY,
  user_id    int REFERENCES app_user(id),   -- 없는 이메일로 실패하면 null
  email      varchar(120) NOT NULL,
  success    boolean NOT NULL,
  ip         varchar(64),
  user_agent varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_history_user_idx ON login_history (user_id, created_at DESC);

-- 문의하기 대화 기록 (결정42). 쌓기만 한다. 로그인 여부는 user_id가 있는지로 계산하고, 손님은 브라우저 번호만 남긴다(IP는 남기지 않음)
CREATE TABLE IF NOT EXISTS chat_log (
  id              serial PRIMARY KEY,
  user_id         int REFERENCES app_user(id),
  guest_id        uuid,
  role            varchar(10),
  conversation_id varchar(64),
  query           text NOT NULL,
  answer          text NOT NULL DEFAULT '',
  sources         jsonb NOT NULL DEFAULT '[]',
  status          varchar(2) NOT NULL CONSTRAINT chat_log_status_check CHECK (status IN ('완료', '멈춤', '오류')),
  error           varchar(200),
  duration_ms     int,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- 로그인 사용자와 손님 중 정확히 하나
  CONSTRAINT chat_log_who_check CHECK ((user_id IS NULL) <> (guest_id IS NULL))
);
CREATE INDEX IF NOT EXISTS chat_log_created_idx ON chat_log (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_log_user_idx ON chat_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id         serial PRIMARY KEY,
  user_id    int REFERENCES app_user(id),   -- 시스템(시드·자동 생성)이면 null
  action     varchar(4) NOT NULL CONSTRAINT audit_log_action_check CHECK (action IN ('생성', '수정', '삭제', '상태변경', '로그인')),
  table_name varchar(40) NOT NULL,
  row_id     int,
  before     jsonb,
  after      jsonb,
  ip         varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- 지금 다니는 학교 = 학생별 effective_from이 가장 늦은 학적 이력
CREATE OR REPLACE VIEW student_current_school AS
SELECT DISTINCT ON (h.student_id)
  h.student_id, h.school_id, s.name AS school_name, s.level, s.region, h.entered_on, h.effective_from
FROM student_school_history h
JOIN school s ON s.id = h.school_id
WHERE h.deleted_at IS NULL
ORDER BY h.student_id, h.effective_from DESC, h.id DESC;

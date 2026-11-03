# academy-enrollment-backend


**배포 주소**: https://academy-enrollment-backend.onrender.com/health — main에 push하면 자동으로 다시 배포돼요.
수학학원 "한빛수학" 수강 신청과 출결 — 백엔드 (NestJS 12 + TypeORM, PostgreSQL 스키마 `hw2`).
코어 웹(`academy-enrollment-web`)과 어드민(`academy-enrollment-admin`)이 함께 쓴다.

## 실행
```bash
cp .env.example .env   # 값 채우기 (DATABASE_URL은 Render External 주소)
npm install
npm run start:dev      # http://localhost:4200/health
```
- 확인: `npm run build`, `npm test`
- 서버를 켜면
  1. `src/database/init.sql`로 `hw2` 스키마·19개 테이블·제약을 만든다 (이미 있으면 그대로)
  2. `.env`의 원장 계정이 없으면 만든다
  3. 학생이 한 명도 없으면 데모 데이터(강사 3·반 4·가족 3·학생 4)를 넣는다

## 구조
- `src/database/init.sql` — 테이블·제약(UQ·CHECK·FK)의 원본. 엔티티는 이 SQL과 칼럼을 맞춘다 (`synchronize` 끔)
- `src/modules/audit/audit.subscriber.ts` — 저장할 때마다 `created_by`·`updated_by`를 채우고 `audit_log`에 전/후 값을 남긴다
- `src/common/guards/auth.guard.ts` — 토큰 확인 + 계정을 매번 다시 확인(사용 중지·탈퇴 즉시 차단, 임시 비밀번호면 변경 전까지 차단)
- 업무 규칙은 `modules/<도메인>/*-rules.ts` 순수 함수 + `*.spec.ts`

## API
| 묶음 | 경로 | 누가 |
|---|---|---|
| 공통 | `GET /health`, `GET /public/classes` | 누구나 |
| 로그인 | `POST /auth/login`·`/auth/signup`, `GET /auth/me`, `POST /auth/password`, (로컬만) `/auth/demo-accounts`·`/auth/demo-login` | 누구나 / 로그인 |
| 학생·학적 | `GET·POST /admin/students`, `GET /admin/students/:id`, `POST .../school-history`·`grade-adjustments`·`notes`·`reset-password`, `GET·POST /admin/schools`, `GET /admin/families` | 원장 |
| 반·강사 | `GET·POST /admin/classes`, `GET·PATCH /admin/classes/:id`, `POST .../sessions/generate`·`extra-sessions`, `POST /admin/sessions/:id/cancel`, `GET·POST /admin/teachers`, `GET /admin/teachers/:id/slots` | 원장 |
| 수강 | `GET /parent/children`·`/parent/classes`, `GET·POST /parent/enrollments`, `POST .../cancel`·`refund-request` / `GET /admin/enrollments`, `POST .../approve`·`reject`·`finish`, `POST /admin/enrollments/phone` | 학부모 / 원장 |
| 출결·보강 | `GET /staff/sessions`, `GET .../roster`, `PUT .../attendance`, `GET /staff/makeups`·`/staff/makeups/needed` / `GET·POST /admin/makeups(…)`, `POST .../confirm`·`reject` / `GET·POST /parent/makeups(…)` | 원장·강사(담당 반) / 원장 / 학부모 |
| 학생 보기 | `GET /student/schedule`, `GET /student/attendance` / `GET /parent/attendance` | 학생 / 학부모 |
| 대시보드 | `GET /admin/dashboard` / `GET /staff/dashboard`, `GET /staff/my-week` / `GET /parent/summary` | 원장 / 강사 / 학부모 |
| 성적 | `GET /staff/scores/classes`, `GET·POST /staff/scores` / `GET /admin/students/:id/scores`, `/parent/scores`, `/student/scores` | 원장·강사(담당 반) / 보기 |
| 직원·탈퇴 | `GET·POST /admin/staff`, `PATCH /admin/staff/:id`, `POST .../reset-password` / `GET·PATCH /parent/account`, `POST /parent/account/withdraw` | 원장 / 학부모 |
| 기록 | `GET /admin/audit/changes`·`logins`·`deleted`, `POST /admin/audit/restore`, `DELETE /admin/notes/:id` | 원장 |
| 돈 | `GET·POST /admin/payments`, `GET /admin/enrollments/:id/refund-preview` / `GET /parent/payments`, `GET /parent/enrollments/:id/refund-preview` | 원장 / 학부모 |

- 업무 규칙은 `modules/*/*-rules.ts`(테스트 `*.spec.ts`): 학년 계산, 강사·학생 시간 겹침, 월 수업일, 수강 신청(중복·정원·학년), 출석률(지각 3 = 결석 1), 보강 조건, 형제 할인, 환불 구간
- 로컬 데모 데이터 초기화: `npm run db:reset` 후 서버 재시작 (`DEMO_LOGIN=true`일 때만 동작)

## 배포 (Render)
- Build `npm install && npm run build`, Start `npm run start:prod`
- 환경 변수: `.env.example`의 항목. `FRONTEND_ORIGIN`에 Vercel 두 주소를 쉼표로. **`DEMO_LOGIN`은 넣지 않는다.**
- 무료 서버는 15분 동안 안 쓰면 잠들어서 첫 접속이 1분 가까이 걸린다. 발표 전에 `/health`를 한 번 열어 깨운다.

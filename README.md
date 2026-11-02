# academy-enrollment-backend

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

## API (지금까지)
| 메서드 | 경로 | 누가 | 설명 |
|---|---|---|---|
| GET | `/health` | 누구나 | 서버·DB 연결 |
| GET | `/public/classes` | 누구나 | 첫 화면 반 목록 (요일·시간·수강료·남은 자리) |
| POST | `/auth/login` | 누구나 | `{ email, password, app: 'web' \| 'admin' }` — 화면에 맞지 않는 역할은 거절 |
| GET | `/auth/me` | 로그인 | 내 정보 (임시 비밀번호여도 됨) |
| POST | `/auth/password` | 로그인 | 비밀번호 변경 → 변경 강제 해제 |
| GET/POST | `/auth/demo-accounts`, `/auth/demo-login` | 로컬만 | `DEMO_LOGIN=true`일 때만. 배포 서버에서는 404 |

## 배포 (Render)
- Build `npm install && npm run build`, Start `npm run start:prod`
- 환경 변수: `.env.example`의 항목. `FRONTEND_ORIGIN`에 Vercel 두 주소를 쉼표로. **`DEMO_LOGIN`은 넣지 않는다.**
- 무료 서버는 15분 동안 안 쓰면 잠들어서 첫 접속이 1분 가까이 걸린다. 발표 전에 `/health`를 한 번 열어 깨운다.

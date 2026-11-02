# hanbit-math-backend

수학학원 "한빛수학" 수강 신청과 출결 — 백엔드 (NestJS 12 + TypeORM, PostgreSQL 스키마 `hw2`).
코어 웹(`hanbit-math-web`)과 어드민(`hanbit-math-admin`)이 함께 쓴다.

## 실행
```bash
cp .env.example .env   # 값 채우기 (DATABASE_URL은 Render External 주소)
npm install
npm run start:dev      # http://localhost:4200/health
```
- 확인: `npm run build`, `npm test`
- 서버를 켜면 `src/database/init.sql`로 `hw2` 스키마와 테이블을 만든다(이미 있으면 그대로 둔다).

## 배포 (Render)
- Build `npm install && npm run build`, Start `npm run start:prod`
- 환경 변수: `.env.example`의 항목. `FRONTEND_ORIGIN`에 Vercel 두 주소를 쉼표로.
- 무료 서버는 15분 동안 안 쓰면 잠들어서 첫 접속이 1분 가까이 걸린다. 발표 전에 `/health`를 한 번 열어 깨운다.

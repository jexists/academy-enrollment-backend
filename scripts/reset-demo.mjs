// 로컬 전용: hw2 스키마를 통째로 지우고 서버를 다시 켜면 테이블과 데모 데이터가 새로 만들어진다.
// 실행: node --env-file=.env scripts/reset-demo.mjs  (배포 DB에는 쓰지 않는다)
import pg from 'pg';

if (process.env.DEMO_LOGIN !== 'true') {
  console.error('DEMO_LOGIN=true인 로컬에서만 쓸 수 있어요.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('DROP SCHEMA IF EXISTS hw2 CASCADE');
await client.end();
console.log('hw2 스키마를 지웠어요. 서버를 다시 켜면 데모 데이터가 새로 들어가요.');

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** 서버와 데이터베이스 연결 확인 */
  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch {
      throw new ServiceUnavailableException('데이터베이스에 연결할 수 없어요.');
    }
  }
}

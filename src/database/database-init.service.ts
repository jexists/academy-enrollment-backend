import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    const sql = readFileSync(new URL('./init.sql', import.meta.url), 'utf8');
    await this.dataSource.query(sql);
    this.logger.log('hw2 스키마와 테이블을 확인했어요');
  }
}

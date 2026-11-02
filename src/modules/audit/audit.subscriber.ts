import { Injectable } from '@nestjs/common';
import {
  DataSource,
  type EntitySubscriberInterface,
  type InsertEvent,
  type RecoverEvent,
  type ObjectLiteral,
  type SoftRemoveEvent,
  type UpdateEvent,
} from 'typeorm';
import { currentContext } from '../../common/context/request-context.js';
import { BaseEntity } from '../../database/base.entity.js';
import { AuditLog, type AuditAction } from './audit-log.entity.js';

/** 기록에 남기지 않는 칸 */
const HIDDEN = new Set(['passwordHash']);
/** 이 칸이 바뀌면 "수정"이 아니라 "상태변경"으로 남긴다 */
const STATUS_FIELDS = ['status', 'isActive'];

function snapshot(
  entity: ObjectLiteral | undefined,
): Record<string, unknown> | null {
  if (!entity) return null;
  return Object.fromEntries(
    Object.entries(entity).filter(([key]) => !HIDDEN.has(key)),
  );
}

/**
 * 공통 칼럼과 변경 기록을 자동으로 처리한다.
 * - 저장 전: created_by·updated_by에 지금 로그인한 사용자를 넣는다 (시드·자동 생성이면 null)
 * - 저장 후: audit_log에 누가·언제·IP·바뀌기 전/후 값을 남긴다 (같은 트랜잭션)
 * repository.save()·softRemove()로 바꿔야 기록된다. update()·query()는 기록되지 않으니 쓰지 않는다.
 */
@Injectable()
export class AuditSubscriber implements EntitySubscriberInterface<BaseEntity> {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return BaseEntity;
  }

  beforeInsert(event: InsertEvent<BaseEntity>) {
    const { userId } = currentContext();
    event.entity.createdBy ??= userId;
    event.entity.updatedBy ??= userId;
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>) {
    if (event.entity) event.entity.updatedBy = currentContext().userId;
  }

  async afterInsert(event: InsertEvent<BaseEntity>) {
    await this.write(event, '생성', null, event.entity);
  }

  async afterUpdate(event: UpdateEvent<BaseEntity>) {
    if (!event.entity) return;
    const before = event.databaseEntity;
    const changed = event.updatedColumns.map((column) => column.propertyName);
    const action: AuditAction = changed.some((key) =>
      STATUS_FIELDS.includes(key),
    )
      ? '상태변경'
      : '수정';
    await this.write(event, action, before, event.entity);
  }

  async afterSoftRemove(event: SoftRemoveEvent<BaseEntity>) {
    await this.write(event, '삭제', event.databaseEntity, null);
  }

  async afterRecover(event: RecoverEvent<BaseEntity>) {
    await this.write(
      event,
      '수정',
      { deletedAt: 'deleted' },
      event.entity ?? null,
    );
  }

  private async write(
    event:
      | InsertEvent<BaseEntity>
      | UpdateEvent<BaseEntity>
      | SoftRemoveEvent<BaseEntity>
      | RecoverEvent<BaseEntity>,
    action: AuditAction,
    before: ObjectLiteral | undefined | null,
    after: ObjectLiteral | undefined | null,
  ) {
    const { userId, ip } = currentContext();
    const rowId = (after?.id ?? before?.id ?? null) as number | null;
    const log = event.manager.create(AuditLog, {
      userId,
      action,
      tableName: event.metadata.tableName,
      rowId,
      before: snapshot(before ?? undefined),
      after: snapshot(after ?? undefined),
      ip,
    });
    await event.manager.save(log);
  }
}

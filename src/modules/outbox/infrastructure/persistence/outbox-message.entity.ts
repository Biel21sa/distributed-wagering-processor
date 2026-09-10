import {
  Entity,
  PrimaryKey,
  Property,
  Index,
} from '@mikro-orm/decorators/legacy';

@Entity({
  tableName: 'outbox_messages',
})
@Index({
  name: 'idx_outbox_pending',
  properties: [
    'publishedAt',
    'nextAttemptAt',
    'occurredAt',
  ],
})
export class OutboxMessageEntity {
  @PrimaryKey({
    type: 'uuid',
  })
  id!: string;

  @Property({
    type: 'uuid',
  })
  aggregateId!: string;

  @Property({
    type: 'string',
  })
  eventType!: string;

  @Property({
    type: 'json',
    columnType: 'jsonb',
  })
  payload!: Record<
    string,
    unknown
  >;

  @Property({
    type: 'datetime',
  })
  occurredAt!: Date;

  @Property({
    type: 'integer',
  })
  attempts!: number;

  @Property({
    nullable: true,
    type: 'datetime',
  })
  nextAttemptAt?:
    | Date
    | null;

  @Property({
    nullable: true,
    type: 'datetime',
  })
  publishedAt?:
    | Date
    | null;
}
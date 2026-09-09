import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
  Index,
} from '@mikro-orm/decorators/legacy';

@Entity({
  tableName: 'inbox_messages',
})
@Unique({
  name: 'uq_inbox_consumer_message',
  properties: [
    'consumerName',
    'messageId',
  ],
})
@Index({
  name: 'idx_inbox_processed_at',
  properties: [
    'processedAt',
  ],
})
export class InboxMessageEntity {
  @PrimaryKey({
    type: 'uuid',
  })
  id!: string;

  @Property({
    type: 'string',
  })
  messageId!: string;

  @Property({
    type: 'string',
  })
  consumerName!: string;

  @Property({
    type: 'string',
  })
  payloadHash!: string;

  @Property({
    type: 'datetime',
  })
  receivedAt!: Date;

  @Property({
    nullable: true,
    type: 'datetime',
  })
  processedAt?: Date | null;
}
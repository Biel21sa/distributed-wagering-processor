import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Unique,
  Index,
} from '@mikro-orm/decorators/legacy';
import { FailureCode } from '../../domain/failure-code.js';
import { WagerTransactionKind } from '../../domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../domain/wager-transaction-status.js';

@Entity({
  tableName: 'wager_transactions',
})
@Unique({
  name: 'uq_wager_idempotency_key',
  properties: ['idempotencyKey'],
})
@Unique({
  name: 'uq_wager_provider_external_id',
  properties: [
    'providerId',
    'externalTransactionId',
  ],
})
@Index({
  name: 'idx_wager_wallet',
  properties: ['walletId'],
})
export class WagerTransactionEntity {
  @PrimaryKey({
    type: 'uuid',
  })
  id!: string;

  @Property({
    type: 'string',
  })
  providerId!: string;

  @Property({
    type: 'string',
  })
  externalTransactionId!: string;

  @Property({
    type: 'string',
  })
  idempotencyKey!: string;

  @Property({
    type: 'string',
  })
  payloadHash!: string;

  @Property({
    type: 'uuid',
  })
  walletId!: string;

  @Property({
    type: 'uuid',
  })
  playerId!: string;

  @Property({
    type: 'string',
  })
  roundId!: string;

  @Property({
    type: 'string',
  })
  gameId!: string;

  @Enum({
    items: () =>
      WagerTransactionKind,
  })
  kind!: WagerTransactionKind;

  @Property({
    type: 'string',
    columnType: 'numeric(20,2)',
  })
  amount!: string;

  @Property({
    type: 'string',
    length: 3,
  })
  currency!: string;

  @Property({
    type: 'string',
    nullable: true,
  })
  referenceExternalTransactionId?:
    | string
    | null;

  @Property({
    type: 'datetime',
  })
  createdAt!: Date;

  @Enum({
    items: () =>
      WagerTransactionStatus,
  })
  status!: WagerTransactionStatus;

  @Property({
    type: 'string',
    nullable: true,
  })
  referenceTransactionId?:
    | string
    | null;

  @Enum({
    items: () => FailureCode,
    nullable: true,
  })
  failureCode?: FailureCode | null;

  @Property({
    type: 'datetime',
    nullable: true,
  })
  processedAt?: Date | null;

  @Property({
    type: 'string',
    nullable: true,
    columnType: 'numeric(20,2)',
  })
  responseBalanceAmount?: string | null;

  @Property({
    type: 'string',
    nullable: true,
    length: 3,
  })
  responseBalanceCurrency?: string | null;

  @Property({
    type: 'integer',
  })
  referenceAttempts = 0;

  @Property({
    nullable: true,
    type: 'datetime',
  })
  referenceNextAttemptAt?:
    | Date
    | null;
}
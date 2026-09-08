import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Unique,
  Index,
} from '@mikro-orm/decorators/legacy';

export enum LedgerDirectionEntity {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

@Entity({
  tableName: 'wallet_ledger_entries',
})
@Unique({
  name: 'uq_ledger_transaction_wallet',
  properties: [
    'walletId',
    'transactionId',
  ],
})
@Index({
  name: 'idx_ledger_wallet_created_at',
  properties: [
    'walletId',
    'createdAt',
  ],
})
export class WalletLedgerEntryEntity {
  @PrimaryKey({
    type: 'uuid',
  })
  id!: string;

  @Property({
    type: 'uuid',
  })
  walletId!: string;

  @Property({
    type: 'uuid',
  })
  transactionId!: string;

  @Enum({
    items: () =>
      LedgerDirectionEntity,
  })
  direction!: LedgerDirectionEntity;

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
    columnType: 'numeric(20,2)',
  })
  balanceBefore!: string;

  @Property({
    type: 'string',
    columnType: 'numeric(20,2)',
  })
  balanceAfter!: string;

  @Property({
    type: 'datetime',
  })
  createdAt!: Date;
}
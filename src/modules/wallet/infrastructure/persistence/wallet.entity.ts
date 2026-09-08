import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
  Index,
} from '@mikro-orm/decorators/legacy';

@Entity({
  tableName: 'wallets',
})
@Unique({
  name: 'uq_wallet_player_currency',
  properties: [
    'playerId',
    'currency',
  ],
})
@Index({
  name: 'idx_wallet_player',
  properties: ['playerId'],
})
export class WalletEntity {
  @PrimaryKey({
    type: 'uuid',
  })
  id!: string;

  @Property({
    type: 'uuid',
  })
  playerId!: string;

  @Property({
    type: 'string',
    length: 3,
  })
  currency!: string;

  @Property({
    type: 'string',
    columnType: 'numeric(20,2)',
  })
  balance!: string;

  @Property({
    type: 'integer',
  })
  version!: number;

  @Property({
    type: 'datetime',
  })
  createdAt!: Date;

  @Property({
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt!: Date;
}
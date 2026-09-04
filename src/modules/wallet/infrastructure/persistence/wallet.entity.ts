import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'wallets' })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  playerId!: string;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Property({
    type: 'numeric',
    columnType: 'numeric(20,2)',
  })
  balance!: string;

  @Property({ type: 'integer' })
  version!: number;

  @Property({ type: 'datetime' })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
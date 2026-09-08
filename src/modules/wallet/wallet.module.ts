import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WalletEntity } from './infrastructure/persistence/wallet.entity.js';
import { WalletLedgerEntryEntity } from './infrastructure/persistence/wallet-ledger-entry.entity.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      WalletEntity,
      WalletLedgerEntryEntity,
    ]),
  ],
})
export class WalletModule {}
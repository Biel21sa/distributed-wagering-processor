import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { WALLET_LEDGER_REPOSITORY } from '../wagering/application/ports/wallet-ledger-repository.port.js';
import { WALLET_REPOSITORY } from '../wagering/application/ports/wallet-repository.port.js';
import { MikroOrmWalletLedgerRepository } from './infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from './infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from './infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from './infrastructure/persistence/wallet.entity.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      WalletEntity,
      WalletLedgerEntryEntity,
    ]),
  ],

  providers: [
    {
      provide: WALLET_REPOSITORY,
      useClass: MikroOrmWalletRepository,
    },

    {
      provide: WALLET_LEDGER_REPOSITORY,
      useClass:
        MikroOrmWalletLedgerRepository,
    },
  ],

  exports: [
    WALLET_REPOSITORY,
    WALLET_LEDGER_REPOSITORY,
  ],
})
export class WalletModule {}
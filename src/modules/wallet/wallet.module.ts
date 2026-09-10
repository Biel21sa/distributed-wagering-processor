import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WALLET_LEDGER_REPOSITORY } from '../wagering/application/ports/wallet-ledger-repository.port.js';
import { WALLET_REPOSITORY } from '../wagering/application/ports/wallet-repository.port.js';
import { MikroOrmWalletLedgerRepository } from './infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from './infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from './infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from './infrastructure/persistence/wallet.entity.js';
import { WalletController } from './api/wallet.controller.js';
import { CreateWalletUseCase } from './application/create-wallet.use-case.js';
import { GetWalletUseCase } from './application/get-wallet.use-case.js';
import { GetWalletLedgerUseCase } from './application/get-wallet-ledger.use-case.js';
import { ReconcileWalletUseCase } from './application/reconcile-wallet.use-case.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      WalletEntity,
      WalletLedgerEntryEntity,
    ]),
  ],

  controllers: [
    WalletController,
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

    {
      provide: CreateWalletUseCase,
      inject: [EntityManager],
      useFactory: (em: EntityManager) =>
        new CreateWalletUseCase(em),
    },

    {
      provide: GetWalletUseCase,
      inject: [EntityManager],
      useFactory: (em: EntityManager) =>
        new GetWalletUseCase(em),
    },

    {
      provide: GetWalletLedgerUseCase,
      inject: [EntityManager],
      useFactory: (em: EntityManager) =>
        new GetWalletLedgerUseCase(em),
    },

    {
      provide: ReconcileWalletUseCase,
      inject: [EntityManager],
      useFactory: (em: EntityManager) =>
        new ReconcileWalletUseCase(em),
    },
  ],

  exports: [
    WALLET_REPOSITORY,
    WALLET_LEDGER_REPOSITORY,
    CreateWalletUseCase,
  ],
})
export class WalletModule { }
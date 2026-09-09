import {
  Module,
} from '@nestjs/common';

import {
  MikroOrmModule,
} from '@mikro-orm/nestjs';

import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WalletModule } from '../wallet/wallet.module.js';
import { WALLET_LEDGER_REPOSITORY } from './application/ports/wallet-ledger-repository.port.js';
import {
  WAGER_TRANSACTION_REPOSITORY,
  WagerTransactionRepository,
} from './application/ports/wager-transaction-repository.port.js';
import { ProcessWagerTransactionUseCase } from './application/process-wager-transaction.use-case.js';
import { MikroOrmWagerTransactionRepository } from './infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { WagerTransactionEntity } from './infrastructure/persistence/wager-transaction.entity.js';
import { WALLET_REPOSITORY } from './application/ports/wallet-repository.port.js';
import { WageringController } from './wagering.controller.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      WagerTransactionEntity,
    ]),

    WalletModule,
  ],

  providers: [
    {
      provide:
        WAGER_TRANSACTION_REPOSITORY,

      inject: [
        EntityManager,
      ],

      useFactory: (
        em: EntityManager,
      ): WagerTransactionRepository =>
        new MikroOrmWagerTransactionRepository(
          em,
        ),
    },

    {
      provide:
        ProcessWagerTransactionUseCase,

      inject: [
        WALLET_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        WALLET_LEDGER_REPOSITORY,
        EntityManager,
      ],

      useFactory: (
        walletRepository,
        transactionRepository,
        ledgerRepository,
        em,
      ) =>
        new ProcessWagerTransactionUseCase(
          walletRepository,
          transactionRepository,
          ledgerRepository,
          em,
        ),
    },
  ],

  controllers: [WageringController],

  exports: [
    ProcessWagerTransactionUseCase,
  ],
})
export class WageringModule { }
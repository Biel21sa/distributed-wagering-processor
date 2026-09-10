import {
  randomUUID,
} from 'node:crypto';

import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { Money } from '../domain/money.js';
import { Wallet } from '../domain/wallet.js';
import {
  LedgerDirection,
  WalletLedgerEntry,
} from '../domain/wallet-ledger-entry.js';
import { WalletLedgerEntryMapper } from '../infrastructure/persistence/wallet-ledger-entry.mapper.js';
import { WalletEntity } from '../infrastructure/persistence/wallet.entity.js';
import { WagerTransaction } from '../../wagering/domain/wager-transaction.js';
import { WagerTransactionMapper } from '../../wagering/infrastructure/persistence/wager-transaction.mapper.js';
import { WalletAlreadyExistsError } from '../../../shared/domain/errors/wallet.error.js';

export interface CreateWalletInput {
  playerId: string;

  initialBalance: {
    amount: string;
    currency: string;
  };
}

export class CreateWalletUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

  async execute(
    input: CreateWalletInput,
  ) {
    return this.em.transactional(
      async (em) => {
        const money =
          Money.from(
            input.initialBalance,
          );

        const existing =
          await em.findOne(
            WalletEntity,
            {
              playerId:
                input.playerId,

              currency:
                money.currency,
            },
          );

        if (existing) {
          throw new WalletAlreadyExistsError();
        }

        const wallet =
          Wallet.open({
            id: randomUUID(),

            playerId:
              input.playerId,

            initialBalance:
              money,
          });

        const walletEntity =
          new WalletEntity();

        walletEntity.id =
          wallet.id;

        walletEntity.playerId =
          wallet.playerId;

        walletEntity.currency =
          wallet.currency;

        walletEntity.balance =
          wallet.balance
            .toJSON()
            .amount;

        walletEntity.version =
          wallet.version;

        walletEntity.createdAt =
          wallet.createdAt;

        walletEntity.updatedAt =
          wallet.updatedAt;

        em.persist(
          walletEntity,
        );

        // Flush the wallet first so it exists in the DB before the OPENING
        // transaction and ledger entry (which carry FKs to wallets) are
        // inserted. The entities don't map explicit relations, so MikroORM
        // can't infer the insert order on its own.
        await em.flush();

        if (
          !money.isZero()
        ) {
          // OPENING is an internal transaction that records the initial
          // balance credit. Wallet -> WagerTransaction(OPENING) ->
          // Ledger(CREDIT) are all persisted in this single SQL transaction.
          const openingTransaction =
            WagerTransaction.openWallet({
              id: randomUUID(),

              walletId:
                wallet.id,

              playerId:
                wallet.playerId,

              money,

              createdAt:
                wallet.createdAt,
            });

          em.persist(
            WagerTransactionMapper.toEntity(
              openingTransaction,
            ),
          );

          // Flush the OPENING transaction before the ledger entry, which
          // carries a FK (fk_ledger_transaction) to wager_transactions.
          await em.flush();

          const zeroBalance =
            Money.from({
              amount: '0.00',
              currency: money.currency,
            });

          const ledgerEntry =
            WalletLedgerEntry.create({
              id: randomUUID(),

              walletId:
                wallet.id,

              transactionId:
                openingTransaction.id,

              direction:
                LedgerDirection.Credit,

              money,

              balanceBefore:
                zeroBalance,

              balanceAfter:
                money,

              createdAt:
                wallet.createdAt,
            });

          em.persist(
            WalletLedgerEntryMapper.toEntity(
              ledgerEntry,
            ),
          );
        }

        await em.flush();

        return {
          id: wallet.id,

          playerId:
            wallet.playerId,

          balance:
            wallet.balance.toJSON(),

          version:
            wallet.version,
        };
      },
      {
        clear: true,
      },
    );
  }
}

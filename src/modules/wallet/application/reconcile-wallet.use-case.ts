import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { ResourceNotFoundError } from '../../../shared/domain/errors/resource-not-found.error.js';
import { Money } from '../domain/money.js';
import { WalletLedgerEntryEntity, LedgerDirectionEntity } from '../infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../infrastructure/persistence/wallet.entity.js';

export class ReconcileWalletUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

  async execute(
    walletId: string,
  ) {
    const wallet =
      await this.em.findOne(
        WalletEntity,
        {
          id: walletId,
        },
      );

    if (!wallet) {
      throw new ResourceNotFoundError(
        'Wallet',
      );
    }

    const entries =
      await this.em.find(
        WalletLedgerEntryEntity,
        {
          walletId,
        },
        {
          orderBy: {
            createdAt: 'asc',
            id: 'asc',
          },
        },
      );

    let calculated =
      Money.zero(
        wallet.currency,
      );

    for (
      const entry of entries
    ) {
      const money =
        Money.from({
          amount:
            entry.amount,

          currency:
            entry.currency,
        });

      if (
        entry.direction ===
        LedgerDirectionEntity.Credit
      ) {
        calculated =
          calculated.add(
            money,
          );
      } else {
        calculated =
          calculated.subtract(
            money,
          );
      }
    }

    const stored =
      Money.from({
        amount:
          wallet.balance,

        currency:
          wallet.currency,
      });

    const difference =
      calculated.subtract(
        stored,
      );

    const consistent =
      stored.equals(
        calculated,
      );

    return {
      walletId:

        wallet.id,

      storedBalance:
        stored.toJSON(),

      calculatedBalance:
        calculated.toJSON(),

      difference:
        difference.toJSON(),

      consistent,

      checkedEntries:
        entries.length,
    };
  }
}
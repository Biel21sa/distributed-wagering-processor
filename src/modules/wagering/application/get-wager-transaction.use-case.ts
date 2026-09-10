import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WagerTransactionEntity } from '../infrastructure/persistence/wager-transaction.entity.js';
import { ResourceNotFoundError } from '../../../shared/domain/errors/resource-not-found.error.js';

export class GetWagerTransactionUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

  async execute(
    transactionId: string,
  ) {
    const transaction =
      await this.em.findOne(
        WagerTransactionEntity,
        {
          id: transactionId,
        },
      );

    if (!transaction) {
      throw new ResourceNotFoundError(
        'Wager transaction',
      );
    }

    return {
      transactionId:
        transaction.id,

      providerId:
        transaction.providerId,

      externalTransactionId:
        transaction.externalTransactionId,

      walletId:
        transaction.walletId,

      playerId:
        transaction.playerId,

      roundId:
        transaction.roundId,

      gameId:
        transaction.gameId,

      kind:
        transaction.kind,

      money: {
        amount:
          transaction.amount,

        currency:
          transaction.currency,
      },

      status:
        transaction.status,

      failureCode:
        transaction.failureCode,

      referenceExternalTransactionId:
        transaction
          .referenceExternalTransactionId,

      referenceTransactionId:
        transaction
          .referenceTransactionId,

      processedAt:
        transaction.processedAt,
    };
  }
}
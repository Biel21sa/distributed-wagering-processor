import { EntityManager } from "@mikro-orm/postgresql";
import { ResourceNotFoundError } from "../../../shared/domain/errors/resource-not-found.error.js";
import { WagerTransactionEntity } from "../infrastructure/persistence/wager-transaction.entity.js";

export class GetProviderTransactionUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

async execute(
  providerId: string,
  externalTransactionId: string,
) {
  const transaction =
    await this.em.findOne(
      WagerTransactionEntity,
      {
        providerId,
        externalTransactionId,
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

    status:
      transaction.status,

    balance: {
      amount:
        transaction
          .responseBalanceAmount
          ?? '0.00',

      currency:
        transaction
          .responseBalanceCurrency
          ?? transaction.currency,
    },

    failureCode:
      transaction.failureCode,
  };
}
}
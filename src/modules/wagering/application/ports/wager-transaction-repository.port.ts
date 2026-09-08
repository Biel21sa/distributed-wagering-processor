import { WagerTransaction } from "../../domain/wager-transaction.js";

export const WAGER_TRANSACTION_REPOSITORY =
  Symbol(
    'WAGER_TRANSACTION_REPOSITORY',
  );

export interface WagerTransactionRepository {
  findById(
    id: string,
  ): Promise<WagerTransaction | null>;

  findByExternalTransactionId(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  save(
    transaction: WagerTransaction,
  ): Promise<void>;
}
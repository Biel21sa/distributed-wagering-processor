import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WagerTransaction } from '../../domain/wager-transaction.js';

export const WAGER_TRANSACTION_REPOSITORY =
  Symbol('WAGER_TRANSACTION_REPOSITORY');

export interface WagerTransactionRepository {
  findById(
    em: EntityManager,
    id: string,
  ): Promise<WagerTransaction | null>;

  findByExternalTransactionId(
    em: EntityManager,
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;

  findByIdempotencyKey(
    em: EntityManager,
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  save(
    em: EntityManager,
    transaction: WagerTransaction,
  ): Promise<void>;
}
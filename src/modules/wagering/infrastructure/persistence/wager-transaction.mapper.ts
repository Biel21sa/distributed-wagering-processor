import { WagerTransaction } from "../../domain/wager-transaction.js";
import { WagerTransactionEntity } from "./wager-transaction.entity.js";


export class WagerTransactionMapper {
  static toEntity(
    transaction: WagerTransaction,
  ): WagerTransactionEntity {
    const entity =
      new WagerTransactionEntity();

    entity.id =
      transaction.id;

    entity.providerId =
      transaction.providerId;

    entity.externalTransactionId =
      transaction.externalTransactionId;

    entity.idempotencyKey =
      transaction.idempotencyKey;

    entity.payloadHash =
      transaction.payloadHash;

    entity.walletId =
      transaction.walletId;

    entity.playerId =
      transaction.playerId;

    entity.roundId =
      transaction.roundId;

    entity.gameId =
      transaction.gameId;

    entity.kind =
      transaction.kind;

    entity.amount =
      transaction.money
        .toJSON()
        .amount;

    entity.currency =
      transaction.money.currency;

    entity.referenceExternalTransactionId =
      transaction
        .referenceExternalTransactionId
      ?? null;

    entity.createdAt =
      transaction.createdAt;

    entity.status =
      transaction.status;

    entity.referenceTransactionId =
      transaction.referenceTransactionId
      ?? null;

    entity.failureCode =
      transaction.failureCode
      ?? null;

    entity.processedAt =
      transaction.processedAt
      ?? null;

    return entity;
  }
}
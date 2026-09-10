import { EntityManager } from '@mikro-orm/postgresql';
import { Money } from "../../../wallet/domain/money.js";
import { WagerTransactionRepository } from "../../application/ports/wager-transaction-repository.port.js";
import { WagerTransaction } from "../../domain/wager-transaction.js";
import { WagerTransactionEntity } from "./wager-transaction.entity.js";
import { WagerTransactionMapper } from "./wager-transaction.mapper.js";
import { WagerTransactionStatus } from '../../domain/wager-transaction-status.js';


export class MikroOrmWagerTransactionRepository
  implements WagerTransactionRepository
{
  constructor(
    private readonly em: EntityManager,
  ) {}

  async findById(
    em: EntityManager,
    id: string,
  ): Promise<WagerTransaction | null> {
    const entity =
      await em.findOne(
        WagerTransactionEntity,
        { id },
      );

    if (!entity) {
      return null;
    }

    return this.toDomain(entity);
  }

  async findByExternalTransactionId(
    em: EntityManager,
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const entity =
      await em.findOne(
        WagerTransactionEntity,
        {
          providerId,
          externalTransactionId,
        },
      );

    if (!entity) {
      return null;
    }

    return this.toDomain(entity);
  }

  async findByIdempotencyKey(
    em: EntityManager,
    idempotencyKey: string,
  ): Promise<WagerTransaction | null> {
    const entity =
      await em.findOne(
        WagerTransactionEntity,
        { idempotencyKey },
      );

    if (!entity) {
      return null;
    }

    return this.toDomain(entity);
  }

  async findPendingReferences(
    em: EntityManager,
    now: Date,
    limit: number,
  ): Promise<WagerTransaction[]> {
    const entities = await em.find(
      WagerTransactionEntity,
      {
        status: WagerTransactionStatus.PendingReference,
        $or: [
          { referenceNextAttemptAt: null },
          { referenceNextAttemptAt: { $lte: now } },
        ],
      },
      {
        limit,
        orderBy: { createdAt: 'asc' },
      },
    );

    return entities.map((entity) => this.toDomain(entity));
  }

  async save(
    em: EntityManager,
    transaction: WagerTransaction,
  ): Promise<void> {
    const entity =
      WagerTransactionMapper
        .toEntity(transaction);

    em.persist(entity);
  }

  private toDomain(
    entity: WagerTransactionEntity,
  ): WagerTransaction {
    return WagerTransaction.rehydrate({
      id: entity.id,

      providerId:
        entity.providerId,

      externalTransactionId:
        entity.externalTransactionId,

      idempotencyKey:
        entity.idempotencyKey,

      payloadHash:
        entity.payloadHash,

      walletId:
        entity.walletId,

      playerId:
        entity.playerId,

      roundId:
        entity.roundId,

      gameId:
        entity.gameId,

      kind:
        entity.kind,

      money: Money.from({
        amount: entity.amount,
        currency: entity.currency,
      }),

      referenceExternalTransactionId:
        entity.referenceExternalTransactionId
        ?? undefined,

      createdAt:
        entity.createdAt,

      status:
        entity.status,

      referenceTransactionId:
        entity.referenceTransactionId
        ?? undefined,

      failureCode:
        entity.failureCode
        ?? undefined,

      processedAt:
        entity.processedAt
        ?? undefined,

      responseBalance:
        entity.responseBalanceAmount &&
        entity.responseBalanceCurrency
          ? Money.from({
            amount:
              entity.responseBalanceAmount,

            currency:
              entity.responseBalanceCurrency,
          })
          : undefined,

      referenceAttempts:
        entity.referenceAttempts,

      referenceNextAttemptAt:
        entity.referenceNextAttemptAt
        ?? undefined,
    });
  }
}
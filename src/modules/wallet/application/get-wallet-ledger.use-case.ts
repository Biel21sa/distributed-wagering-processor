import { EntityManager } from "@mikro-orm/postgresql";
import { decodeCursor, encodeCursor, LedgerQueryDto } from "../api/dto/ledger-query.dto.js";
import { WalletLedgerEntryEntity } from "../infrastructure/persistence/wallet-ledger-entry.entity.js";

export class GetWalletLedgerUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

async execute(
  walletId: string,
  query: LedgerQueryDto,
) {
  const limit =
    query.limit ?? 50;

  const conditions: any = {
    walletId,
  };

  if (query.cursor) {
    const cursor =
      decodeCursor(
        query.cursor,
      );

    conditions.$or = [
      {
        createdAt: {
          $lt:
            cursor.createdAt,
        },
      },
      {
        createdAt:
          cursor.createdAt,

        id: {
          $lt:
            cursor.id,
        },
      },
    ];
  }

  const entries =
    await this.em.find(
      WalletLedgerEntryEntity,
      conditions,
      {
        orderBy: {
          createdAt: 'desc',
          id: 'desc',
        },

        limit:
          limit + 1,
      },
    );

  const hasNext =
    entries.length >
    limit;

  const page =
    entries.slice(
      0,
      limit,
    );

  const nextCursor =
    hasNext &&
    page.length > 0
      ? encodeCursor(
          page[
            page.length - 1
          ].createdAt,

          page[
            page.length - 1
          ].id,
        )
      : null;

  return {
    items: page.map(
      (entry) => ({
        id:
          entry.id,

        transactionId:
          entry.transactionId,

        direction:
          entry.direction,

        money: {
          amount:
            entry.amount,

          currency:
            entry.currency,
        },

        balanceBefore: {
          amount:
            entry.balanceBefore,

          currency:
            entry.currency,
        },

        balanceAfter: {
          amount:
            entry.balanceAfter,

          currency:
            entry.currency,
        },

        createdAt:
          entry.createdAt,
      }),
    ),

    nextCursor,
  };
}
}
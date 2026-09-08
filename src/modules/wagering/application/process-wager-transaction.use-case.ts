import { EntityManager } from '@mikro-orm/postgresql';
import { randomUUID } from "crypto";
import { Money } from "../../wallet/domain/money.js";
import { WalletLedgerEntry, LedgerDirection } from "../../wallet/domain/wallet-ledger-entry.js";
import { FailureCode } from "../domain/failure-code.js";
import { WagerTransactionKind } from "../domain/wager-transaction-kind.js";
import { WagerTransactionStatus } from "../domain/wager-transaction-status.js";
import { WagerTransaction } from "../domain/wager-transaction.js";
import { WagerTransactionRepository } from "./ports/wager-transaction-repository.port.js";
import { WalletLedgerRepository } from "./ports/wallet-ledger-repository.port.js";
import { WalletRepository } from "./ports/wallet-repository.port.js";


export interface ProcessWagerTransactionInput {
  providerId: string;
  externalTransactionId: string;

  idempotencyKey: string;
  payloadHash: string;

  playerId: string;
  walletId: string;

  roundId: string;
  gameId: string;

  kind: WagerTransactionKind;

  money: {
    amount: string;
    currency: string;
  };

  referenceExternalTransactionId?: string;
}

export interface ProcessWagerTransactionResult {
  transactionId: string;

  status: WagerTransactionStatus;

  balance: {
    amount: string;
    currency: string;
  };

  idempotentReplay: boolean;

  failureCode?: FailureCode;
}

export class ProcessWagerTransactionUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,

    private readonly transactionRepository:
      WagerTransactionRepository,

    private readonly ledgerRepository:
      WalletLedgerRepository,

    private readonly em: EntityManager,
  ) {}

  async execute(
    input: ProcessWagerTransactionInput,
  ): Promise<ProcessWagerTransactionResult> {
    return this.em.transactional(
      async (em) => {
        return this.executeTransaction(
          em,
          input,
        );
      },
      {
        clear: true,
      },
    );
  }

  private async executeTransaction(
    em: EntityManager,
    input: ProcessWagerTransactionInput,
  ): Promise<ProcessWagerTransactionResult> {
    const transaction =
      WagerTransaction.create({
        id: randomUUID(),

        providerId:
          input.providerId,

        externalTransactionId:
          input.externalTransactionId,

        idempotencyKey:
          input.idempotencyKey,

        payloadHash:
          input.payloadHash,

        playerId:
          input.playerId,

        walletId:
          input.walletId,

        roundId:
          input.roundId,

        gameId:
          input.gameId,

        kind:
          input.kind,

        money:
          Money.from(input.money),

        referenceExternalTransactionId:
          input.referenceExternalTransactionId,
      });

    const wallet =
      await this.walletRepository
        .findByIdForUpdate(
          em,
          input.walletId,
        );

    if (!wallet) {
      transaction.reject(
        FailureCode.InvalidTransaction,
      );

      await this.transactionRepository.save(
        em,
        transaction,
      );

      return {
        transactionId:
          transaction.id,

        status:
          transaction.status,

        balance:
          transaction.money.toJSON(),

        idempotentReplay:
          false,

        failureCode:
          transaction.failureCode,
      };
    }

    const balanceBefore =
      wallet.balance;

    let ledgerEntry:
      | WalletLedgerEntry
      | undefined;

    try {
      switch (transaction.kind) {
        case WagerTransactionKind.Bet: {
          wallet.debit(
            transaction.money,
          );

          ledgerEntry =
            WalletLedgerEntry.create({
              id: randomUUID(),

              walletId:
                wallet.id,

              transactionId:
                transaction.id,

              direction:
                LedgerDirection.Debit,

              money:
                transaction.money,

              balanceBefore,

              balanceAfter:
                wallet.balance,
            });

          transaction.markProcessed(
            undefined,
            new Date(),
          );

          break;
        }

        case WagerTransactionKind.Win: {
          wallet.credit(
            transaction.money,
          );

          ledgerEntry =
            WalletLedgerEntry.create({
              id: randomUUID(),

              walletId:
                wallet.id,

              transactionId:
                transaction.id,

              direction:
                LedgerDirection.Credit,

              money:
                transaction.money,

              balanceBefore,

              balanceAfter:
                wallet.balance,
            });

          transaction.markProcessed(
            undefined,
            new Date(),
          );

          break;
        }

        case WagerTransactionKind.Loss: {
          transaction.markProcessed(
            undefined,
            new Date(),
          );

          break;
        }

        case WagerTransactionKind.Refund:
        case WagerTransactionKind.Rollback: {
          transaction.markPendingReference();

          break;
        }

        default: {
          transaction.reject(
            FailureCode.InvalidTransaction,
          );
        }
      }

      await this.transactionRepository.save(
        em,
        transaction,
      );

      await this.walletRepository.save(
        em,
        wallet,
      );

      if (ledgerEntry) {
        await this.ledgerRepository.save(
          em,
          ledgerEntry,
        );
      }

      return {
        transactionId:
          transaction.id,

        status:
          transaction.status,

        balance:
          wallet.balance.toJSON(),

        idempotentReplay:
          false,

        failureCode:
          transaction.failureCode,
      };
    } catch (error) {
      if (
        error instanceof
        Error &&
        error.message ===
          'Wallet has insufficient funds'
      ) {
        transaction.reject(
          FailureCode.InsufficientFunds,
        );

        await this.transactionRepository.save(
          em,
          transaction,
        );

        return {
          transactionId:
            transaction.id,

          status:
            transaction.status,

          balance:
            wallet.balance.toJSON(),

          idempotentReplay:
            false,

          failureCode:
            transaction.failureCode,
        };
      }

      throw error;
    }
  }
}
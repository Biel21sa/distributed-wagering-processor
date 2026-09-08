import { randomUUID } from "crypto";
import { WalletLedgerEntry, LedgerDirection } from "../../wallet/domain/wallet-ledger-entry.js";
import { FailureCode } from "../domain/failure-code.js";
import { WagerTransactionKind } from "../domain/wager-transaction-kind.js";
import { WagerTransactionStatus } from "../domain/wager-transaction-status.js";
import { WagerTransaction } from "../domain/wager-transaction.js";
import { WagerTransactionRepository } from "./ports/wager-transaction-repository.port.js";
import { WalletRepository } from "./ports/wallet-repository.port.js";
import { Money } from "../../wallet/domain/money.js";


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

export class ProcessWagerTransactionUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: WagerTransactionRepository,
  ) {}

  async execute(
    input: ProcessWagerTransactionInput,
  ): Promise<{
    result: {
      transactionId: string;
      status: WagerTransactionStatus;
      balance: {
        amount: string;
        currency: string;
      };
      idempotentReplay: boolean;
      failureCode?: FailureCode;
    };
    ledgerEntry?: WalletLedgerEntry;
  }> {
    // Implementaremos a transação SQL real na próxima etapa.
    // Por enquanto, estamos estabelecendo a regra de negócio.

    const existingByKey =
      await this.transactionRepository
        .findByIdempotencyKey(
          input.idempotencyKey,
        );

    if (existingByKey) {
      if (
        !existingByKey.matchesPayload(
          input.payloadHash,
        )
      ) {
        throw new Error(
          'IDEMPOTENCY_CONFLICT',
        );
      }

      const wallet =
        await this.walletRepository.findById(
          existingByKey.walletId,
        );

      if (!wallet) {
        throw new Error(
          'Wallet not found',
        );
      }

      return {
        result: {
          transactionId: existingByKey.id,
          status: existingByKey.status,
          balance: wallet.balance.toJSON(),
          idempotentReplay: true,
          failureCode:
            existingByKey.failureCode,
        },
      };
    }

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

        walletId:
          input.walletId,

        playerId:
          input.playerId,

        roundId:
          input.roundId,

        gameId:
          input.gameId,

        kind:
          input.kind,

        money: Money.from(input.money),

        referenceExternalTransactionId:
          input.referenceExternalTransactionId,
      });

    const wallet =
      await this.walletRepository.findById(
        transaction.walletId,
      );

    if (!wallet) {
      transaction.reject(
        FailureCode.InvalidTransaction,
      );

      await this.transactionRepository.save(
        transaction,
      );

      return {
        result: {
          transactionId:
            transaction.id,
          status:
            transaction.status,
          balance: {
            amount: '0.00',
            currency:
              transaction.money.currency,
          },
          idempotentReplay: false,
          failureCode:
            transaction.failureCode,
        },
      };
    }

    const balanceBefore =
      wallet.balance;

    try {
      let ledgerEntry:
        | WalletLedgerEntry
        | undefined;

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

          // A resolução da referência entra
          // logo depois desta etapa.

          break;
        }

        default: {
          transaction.reject(
            FailureCode.InvalidTransaction,
          );
        }
      }

      await this.transactionRepository.save(
        transaction,
      );

      await this.walletRepository.save(
        wallet,
      );

      return {
        result: {
          transactionId:
            transaction.id,

          status:
            transaction.status,

          balance:
            wallet.balance.toJSON(),

          idempotentReplay: false,

          failureCode:
            transaction.failureCode,
        },

        ledgerEntry,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          'Wallet has insufficient funds'
      ) {
        transaction.reject(
          FailureCode.InsufficientFunds,
        );

        await this.transactionRepository.save(
          transaction,
        );

        return {
          result: {
            transactionId:
              transaction.id,

            status:
              transaction.status,

            balance:
              wallet.balance.toJSON(),

            idempotentReplay: false,

            failureCode:
              transaction.failureCode,
          },
        };
      }

      throw error;
    }
  }
}
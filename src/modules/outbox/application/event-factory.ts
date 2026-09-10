import {
  randomUUID,
} from 'node:crypto';
import { WagerTransaction } from '../../wagering/domain/wager-transaction.js';
import { WalletLedgerEntry } from '../../wallet/domain/wallet-ledger-entry.js';
import { Wallet } from '../../wallet/domain/wallet.js';
import { WagerTransactionProcessed } from '../domain/wager-transaction-processed.js';
import { WagerTransactionRejected } from '../domain/wager-transaction-rejected.js';
import { WagerTransactionPendingReference } from '../domain/wager-transaction-pending-reference.js';
import { WalletBalanceChanged } from '../domain/wallet-balance-changed.js';

export interface EventContext {
  correlationId: string;
  causationId?: string;
}

export class EventFactory {
  static transactionProcessed(
    transaction: WagerTransaction,
    wallet: Wallet,
    context: EventContext,
  ) {
    return WagerTransactionProcessed.from({
      eventId: randomUUID(),

      aggregateId:
        wallet.id,

      correlationId:
        context.correlationId,

      causationId:
        context.causationId,

      occurredAt:
        new Date(),

      data: {
        transactionId:
          transaction.id,

        providerId:
          transaction.providerId,

        externalTransactionId:
          transaction.externalTransactionId,

        walletId:
          wallet.id,

        playerId:
          wallet.playerId,

        roundId:
          transaction.roundId,

        gameId:
          transaction.gameId,

        kind:
          transaction.kind,

        money:
          transaction.money.toJSON(),

        balance:
          wallet.balance.toJSON(),
      },
    });
  }

  static balanceChanged(
    transaction: WagerTransaction,
    wallet: Wallet,
    entry: WalletLedgerEntry,
    context: EventContext,
  ) {
    return WalletBalanceChanged.from({
      eventId: randomUUID(),

      aggregateId:
        wallet.id,

      correlationId:
        context.correlationId,

      causationId:
        context.causationId,

      occurredAt:
        new Date(),

      data: {
        walletId:
          wallet.id,

        transactionId:
          transaction.id,

        direction:
          entry.direction,

        money:
          entry.money.toJSON(),

        balanceBefore:
          entry.balanceBefore.toJSON(),

        balanceAfter:
          entry.balanceAfter.toJSON(),

        walletVersion:
          wallet.version,
      },
    });
  }

  static transactionRejected(
    transaction: WagerTransaction,
    wallet: Wallet,
    context: EventContext,
  ) {
    return WagerTransactionRejected.from({
      eventId: randomUUID(),

      aggregateId:
        wallet.id,

      correlationId:
        context.correlationId,

      causationId:
        context.causationId,

      occurredAt:
        new Date(),

      data: {
        transactionId:
          transaction.id,

        providerId:
          transaction.providerId,

        externalTransactionId:
          transaction.externalTransactionId,

        walletId:
          wallet.id,

        playerId:
          wallet.playerId,

        failureCode:
          transaction.failureCode!,

        balance:
          wallet.balance.toJSON(),
      },
    });
  }

  static pendingReference(
    transaction: WagerTransaction,
    context: EventContext,
  ) {
    return WagerTransactionPendingReference.from({
      eventId: randomUUID(),

      aggregateId:
        transaction.walletId,

      correlationId:
        context.correlationId,

      causationId:
        context.causationId,

      occurredAt:
        new Date(),

      data: {
        transactionId:
          transaction.id,

        providerId:
          transaction.providerId,

        externalTransactionId:
          transaction.externalTransactionId,

        walletId:
          transaction.walletId,

        referenceExternalTransactionId:
          transaction.referenceExternalTransactionId!,
      },
    });
  }
}
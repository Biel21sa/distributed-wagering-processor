import { WagerTransactionKind } from '../../wagering/domain/wager-transaction-kind.js';
import { PermanentMessageError } from './message-error.js';
import { WagerTransactionRequestedMessage } from '../domain/wager-transaction-requested.event.js';

export function validateWagerMessage(
  value: unknown,
): WagerTransactionRequestedMessage {
  if (!isRecord(value)) {
    throw new PermanentMessageError('Message body must be an object');
  }

  const data = value.data;
  if (
    value.type !== 'WagerTransactionRequested' ||
    typeof value.messageId !== 'string' ||
    typeof value.occurredAt !== 'string' ||
    !isRecord(data) ||
    typeof data.providerId !== 'string' ||
    typeof data.externalTransactionId !== 'string' ||
    typeof data.idempotencyKey !== 'string' ||
    typeof data.playerId !== 'string' ||
    typeof data.walletId !== 'string' ||
    typeof data.roundId !== 'string' ||
    typeof data.gameId !== 'string' ||
    !Object.values(WagerTransactionKind).includes(data.kind as WagerTransactionKind) ||
    !isMoney(data.money)
  ) {
    throw new PermanentMessageError('Invalid WagerTransactionRequested schema');
  }

  return value as unknown as WagerTransactionRequestedMessage;
}

function isMoney(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.amount === 'string' &&
    typeof value.currency === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { createHash } from 'node:crypto';

export interface WagerPayloadForHash {
  providerId: string;
  externalTransactionId: string;

  playerId: string;
  walletId: string;

  roundId: string;
  gameId: string;

  kind: string;

  money: {
    amount: string;
    currency: string;
  };

  referenceExternalTransactionId?: string;
}

function sortObject(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const object =
      value as Record<string, unknown>;

    return Object.keys(object)
      .sort()
      .reduce(
        (
          result,
          key,
        ) => {
          result[key] =
            sortObject(object[key]);

          return result;
        },
        {} as Record<string, unknown>,
      );
  }

  return value;
}

export function canonicalize(
  payload: WagerPayloadForHash,
): string {
  return JSON.stringify(
    sortObject(payload),
  );
}

export function calculatePayloadHash(
  payload: WagerPayloadForHash,
): string {
  const canonicalPayload =
    canonicalize(payload);

  return createHash('sha256')
    .update(canonicalPayload)
    .digest('hex');
}
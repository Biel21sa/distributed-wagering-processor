import { Money } from "../../wallet/domain/money.js";
import { FailureCode } from "./failure-code.js";
import { WagerTransactionKind } from "./wager-transaction-kind.js";
import { WagerTransactionStatus } from "./wager-transaction-status.js";
import { WagerTransaction } from "./wager-transaction.js";


const validProps = {
  id: 'transaction-1',

  providerId: 'provider-a',

  externalTransactionId:
    'external-1',

  idempotencyKey:
    'provider-a:external-1',

  payloadHash: 'hash-123',

  walletId: crypto.randomUUID(),

  playerId: crypto.randomUUID(),

  roundId: 'round-1',

  gameId: 'fortune-chimp',

  money: Money.from({
    amount: '25.00',
    currency: 'BRL',
  }),
};

describe(
  'WagerTransaction',
  () => {
    test(
      'should create a pending bet',
      () => {
        const transaction =
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Bet,
          });

        expect(
          transaction.status,
        ).toBe(
          WagerTransactionStatus.Pending,
        );
      },
    );

    test(
      'should require reference for refund',
      () => {
        expect(() =>
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Refund,
          }),
        ).toThrow();
      },
    );

    test(
      'should require reference for rollback',
      () => {
        expect(() =>
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Rollback,
          }),
        ).toThrow();
      },
    );

    test(
      'should reject opening from external input',
      () => {
        expect(() =>
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Opening,
          }),
        ).toThrow();
      },
    );

    test(
      'should mark transaction as processed',
      () => {
        const transaction =
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Bet,
          });

        transaction.markProcessed(
          undefined,
          validProps.money,
          new Date(),
        );

        expect(
          transaction.status,
        ).toBe(
          WagerTransactionStatus.Processed,
        );

        expect(
          transaction.isTerminal(),
        ).toBe(true);
      },
    );

    test(
      'should reject terminal transition',
      () => {
        const transaction =
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Bet,
          });

        transaction.markProcessed(
          undefined,
          validProps.money,
          new Date(),
        );

        expect(() =>
          transaction.reject(
            FailureCode.InvalidTransaction,
          ),
        ).toThrow();
      },
    );

    test(
      'should detect payload mismatch',
      () => {
        const transaction =
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Bet,
          });

        expect(
          transaction.matchesPayload(
            'different-hash',
          ),
        ).toBe(false);
      },
    );

    test(
      'LOSS should not affect balance',
      () => {
        const transaction =
          WagerTransaction.create({
            ...validProps,
            kind:
              WagerTransactionKind.Loss,
          });

        expect(
          transaction.affectsBalance(),
        ).toBe(false);
      },
    );
  },
);
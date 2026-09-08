import { Money } from "./money.js";
import { LedgerDirection, WalletLedgerEntry } from "./wallet-ledger-entry.js";


describe('WalletLedgerEntry', () => {
  test('should create a valid debit entry', () => {
    const entry =
      WalletLedgerEntry.create({
        id: crypto.randomUUID(),
        walletId: crypto.randomUUID(),
        transactionId: crypto.randomUUID(),
        direction:
          LedgerDirection.Debit,
        money: Money.from({
          amount: '20.00',
          currency: 'BRL',
        }),
        balanceBefore: Money.from({
          amount: '100.00',
          currency: 'BRL',
        }),
        balanceAfter: Money.from({
          amount: '80.00',
          currency: 'BRL',
        }),
      });

    expect(entry.isBalanced()).toBe(
      true,
    );
  });

  test('should create a valid credit entry', () => {
    const entry =
      WalletLedgerEntry.create({
        id: crypto.randomUUID(),
        walletId: crypto.randomUUID(),
        transactionId: crypto.randomUUID(),
        direction:
          LedgerDirection.Credit,
        money: Money.from({
          amount: '20.00',
          currency: 'BRL',
        }),
        balanceBefore: Money.from({
          amount: '100.00',
          currency: 'BRL',
        }),
        balanceAfter: Money.from({
          amount: '120.00',
          currency: 'BRL',
        }),
      });

    expect(entry.isBalanced()).toBe(
      true,
    );
  });

  test('should reject an unbalanced entry', () => {
    expect(() =>
      WalletLedgerEntry.create({
        id: crypto.randomUUID(),
        walletId: crypto.randomUUID(),
        transactionId: crypto.randomUUID(),
        direction:
          LedgerDirection.Debit,
        money: Money.from({
          amount: '20.00',
          currency: 'BRL',
        }),
        balanceBefore: Money.from({
          amount: '100.00',
          currency: 'BRL',
        }),
        balanceAfter: Money.from({
          amount: '90.00',
          currency: 'BRL',
        }),
      }),
    ).toThrow();
  });
});
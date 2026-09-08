import { Money } from "./money.js";
import { Wallet } from "./wallet.js";


describe('Wallet', () => {
  test('should start with version 1', () => {
    const wallet = Wallet.open({
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

    expect(wallet.version).toBe(1);
    expect(wallet.balance.toString())
      .toBe('100.00');
  });

  test('should debit balance', () => {
    const wallet = Wallet.open({
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

    wallet.debit(
      Money.from({
        amount: '30.00',
        currency: 'BRL',
      }),
    );

    expect(wallet.balance.toString())
      .toBe('70.00');

    expect(wallet.version).toBe(2);
  });

  test('should credit balance', () => {
    const wallet = Wallet.open({
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

    wallet.credit(
      Money.from({
        amount: '30.00',
        currency: 'BRL',
      }),
    );

    expect(wallet.balance.toString())
      .toBe('130.00');

    expect(wallet.version).toBe(2);
  });

  test('should not allow insufficient funds', () => {
    const wallet = Wallet.open({
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

    expect(() =>
      wallet.debit(
        Money.from({
          amount: '101.00',
          currency: 'BRL',
        }),
      ),
    ).toThrow();
  });

  test('version should increase only when balance changes', () => {
    const wallet = Wallet.open({
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

    expect(wallet.version).toBe(1);

    wallet.debit(
      Money.from({
        amount: '10.00',
        currency: 'BRL',
      }),
    );

    expect(wallet.version).toBe(2);
  });
});
import { CurrencyMismatchError, InvalidMoneyError } from "../../../shared/domain/errors/money.error.js";
import { Money } from "./money.js";


describe('Money', () => {
  test('should create money', () => {
    const money = Money.from({
      amount: '25.00',
      currency: 'BRL',
    });

    expect(money.toString()).toBe(
      '25.00',
    );
  });

  test('should normalize amount', () => {
    const money = Money.from({
      amount: '25',
      currency: 'BRL',
    });

    expect(money.toString()).toBe(
      '25.00',
    );
  });

  test('should reject more than 2 decimal places', () => {
    expect(() =>
      Money.from({
        amount: '25.123',
        currency: 'BRL',
      }),
    ).toThrow(InvalidMoneyError);
  });

  test('should reject scientific notation', () => {
    expect(() =>
      Money.from({
        amount: '1e3',
        currency: 'BRL',
      }),
    ).toThrow(InvalidMoneyError);
  });

  test('should reject invalid values', () => {
    expect(() =>
      Money.from({
        amount: 'NaN',
        currency: 'BRL',
      }),
    ).toThrow(InvalidMoneyError);
  });

  test('should add money', () => {
    const a = Money.from({
      amount: '10.00',
      currency: 'BRL',
    });

    const b = Money.from({
      amount: '15.00',
      currency: 'BRL',
    });

    expect(
      a.add(b).toString(),
    ).toBe('25.00');
  });

  test('should subtract money', () => {
    const a = Money.from({
      amount: '30.00',
      currency: 'BRL',
    });

    const b = Money.from({
      amount: '10.00',
      currency: 'BRL',
    });

    expect(
      a.subtract(b).toString(),
    ).toBe('20.00');
  });

  test('should reject different currencies', () => {
    const brl = Money.from({
      amount: '10.00',
      currency: 'BRL',
    });

    const usd = Money.from({
      amount: '10.00',
      currency: 'USD',
    });

    expect(() =>
      brl.add(usd),
    ).toThrow(CurrencyMismatchError);
  });

  test('should be immutable', () => {
    const money = Money.from({
      amount: '100.00',
      currency: 'BRL',
    });

    const result = money.add(
      Money.from({
        amount: '50.00',
        currency: 'BRL',
      }),
    );

    expect(
      money.toString(),
    ).toBe('100.00');

    expect(
      result.toString(),
    ).toBe('150.00');
  });
});
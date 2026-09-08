import { Decimal } from "decimal.js";
import { CurrencyMismatchError, InvalidMoneyError } from "../../../shared/domain/errors/money.error.js";


export interface MoneyProps {
  amount: string;
  currency: string;
}

export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {}

  static from(props: MoneyProps): Money {
    const currency = props.currency?.trim().toUpperCase();
    const amount = props.amount?.trim();

    if (!currency) {
      throw new InvalidMoneyError(
        'Currency is required',
      );
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new InvalidMoneyError(
        'Currency must be a valid ISO-4217 code',
      );
    }

    if (!amount) {
      throw new InvalidMoneyError(
        'Amount is required',
      );
    }

    if (!/^-?\d+(\.\d+)?$/.test(amount)) {
      throw new InvalidMoneyError(
        'Amount must be a decimal string',
      );
    }

    const decimal = new Decimal(amount);

    if (!decimal.isFinite()) {
      throw new InvalidMoneyError(
        'Amount must be finite',
      );
    }

    if (decimal.isNegative()) {
      throw new InvalidMoneyError(
        'Amount cannot be negative',
      );
    }

    const decimalPlaces = decimal.decimalPlaces();

    if (decimalPlaces > 2) {
      throw new InvalidMoneyError(
        'Amount cannot have more than 2 decimal places',
      );
    }

    return new Money(
      decimal.toDecimalPlaces(2),
      currency,
    );
  }

  static zero(currency: string): Money {
    return Money.from({
      amount: '0.00',
      currency,
    });
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);

    return Money.from({
      amount: this.value
        .plus(other.value)
        .toFixed(2),
      currency: this.currency,
    });
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);

    const result = this.value.minus(other.value);

    if (result.isNegative()) {
      throw new InvalidMoneyError(
        'Money result cannot be negative',
      );
    }

    return Money.from({
      amount: result.toFixed(2),
      currency: this.currency,
    });
  }

  negate(): Money {
    return Money.fromAllowNegative({
      amount: this.value.negated().toFixed(2),
      currency: this.currency,
    });
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);

    return this.value.lessThan(other.value);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);

    return this.value.greaterThan(other.value);
  }

  equals(other: Money): boolean {
    return (
      this.currency === other.currency &&
      this.value.equals(other.value)
    );
  }

  toJSON(): MoneyProps {
    return {
      amount: this.value.toFixed(2),
      currency: this.currency,
    };
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(
        this.currency,
        other.currency,
      );
    }
  }

  /**
   * Apenas para operações internas do domínio
   * que podem produzir valor negativo, como negate().
   */
  private static fromAllowNegative(
    props: MoneyProps,
  ): Money {
    const currency = props.currency?.trim().toUpperCase();
    const amount = props.amount?.trim();

    if (
      !currency ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      throw new InvalidMoneyError(
        'Invalid currency',
      );
    }

    if (
      !amount ||
      !/^-?\d+(\.\d+)?$/.test(amount)
    ) {
      throw new InvalidMoneyError(
        'Invalid amount',
      );
    }

    const decimal = new Decimal(amount);

    if (!decimal.isFinite()) {
      throw new InvalidMoneyError(
        'Amount must be finite',
      );
    }

    if (decimal.decimalPlaces() > 2) {
      throw new InvalidMoneyError(
        'Amount cannot have more than 2 decimal places',
      );
    }

    return new Money(
      decimal.toDecimalPlaces(2),
      currency,
    );
  }
}
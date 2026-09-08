import { DomainError } from "./domain.error.js";

export class InvalidMoneyError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_MONEY');
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(
    expected: string,
    received: string,
  ) {
    super(
      `Currency mismatch: expected ${expected}, received ${received}`,
      'CURRENCY_MISMATCH',
    );
  }
}
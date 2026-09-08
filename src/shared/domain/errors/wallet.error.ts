import { DomainError } from "./domain.error.js";

export class InsufficientFundsError extends DomainError {
  constructor() {
    super(
      'Wallet has insufficient funds',
      'INSUFFICIENT_FUNDS',
    );
  }
}

export class NegativeBalanceError extends DomainError {
  constructor() {
    super(
      'Wallet balance cannot be negative',
      'NEGATIVE_BALANCE',
    );
  }
}
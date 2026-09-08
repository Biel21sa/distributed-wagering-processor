export enum FailureCode {
  InvalidTransaction = 'INVALID_TRANSACTION',
  InsufficientFunds = 'INSUFFICIENT_FUNDS',
  CurrencyMismatch = 'CURRENCY_MISMATCH',

  ReferenceNotFound = 'REFERENCE_NOT_FOUND',
  ReferenceInvalid = 'REFERENCE_INVALID',

  InvalidRefundReference = 'INVALID_REFUND_REFERENCE',
  InvalidRollbackReference = 'INVALID_ROLLBACK_REFERENCE',

  DuplicateReversal = 'DUPLICATE_REVERSAL',

  NegativeBalance = 'NEGATIVE_BALANCE',

  IdempotencyConflict = 'IDEMPOTENCY_CONFLICT',

  InternalError = 'INTERNAL_ERROR',
}
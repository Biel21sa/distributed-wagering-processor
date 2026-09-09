import { DomainError } from "../../../shared/domain/errors/domain.error.js";

export class IdempotencyConflictError
  extends DomainError
{
  constructor() {
    super(
      'The idempotency key was already used with a different payload',
      'IDEMPOTENCY_CONFLICT',
    );
  }
}
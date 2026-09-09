export enum MessageErrorCategory {
  Business = 'BUSINESS',
  Transient = 'TRANSIENT',
  Permanent = 'PERMANENT',
}

export class PermanentMessageError extends Error {
  readonly category = MessageErrorCategory.Permanent;

  constructor(message: string) {
    super(message);
    this.name = 'PermanentMessageError';
  }
}

export function classifyMessageError(
  error: unknown,
): MessageErrorCategory {
  if (error instanceof PermanentMessageError) {
    return MessageErrorCategory.Permanent;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    (error as { category?: unknown }).category === MessageErrorCategory.Business
  ) {
    return MessageErrorCategory.Business;
  }

  return MessageErrorCategory.Transient;
}

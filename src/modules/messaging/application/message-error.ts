export enum MessageErrorCategory {
  Business = 'BUSINESS',
  Transient = 'TRANSIENT',
  Permanent = 'PERMANENT',
}

export class PermanentMessageError extends Error {
  readonly category = MessageErrorCategory.Permanent;
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = message ? code : 'PERMANENT_MESSAGE_ERROR';
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

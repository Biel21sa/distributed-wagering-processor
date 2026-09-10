export enum MessageErrorType {
  Business = 'BUSINESS',
  Transient = 'TRANSIENT',
  Permanent = 'PERMANENT',
}

export class MessageProcessingError
  extends Error
{
  constructor(
    message: string,
    public readonly type: MessageErrorType,
    public readonly code: string,
  ) {
    super(message);

    this.name =
      'MessageProcessingError';
  }
}
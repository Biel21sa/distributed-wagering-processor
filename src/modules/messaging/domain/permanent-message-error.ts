import { MessageErrorType, MessageProcessingError } from "./message-errors.js";


export class PermanentMessageError
  extends MessageProcessingError
{
  constructor(
    code: string,
    message: string,
  ) {
    super(
      message,
      MessageErrorType.Permanent,
      code,
    );
  }
}
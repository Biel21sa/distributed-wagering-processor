import { MessageErrorType, MessageProcessingError } from "../../messaging/domain/message-errors.js";


export class BusinessRuleError
  extends MessageProcessingError
{
  constructor(
    code: string,
    message: string,
  ) {
    super(
      message,
      MessageErrorType.Business,
      code,
    );
  }
}
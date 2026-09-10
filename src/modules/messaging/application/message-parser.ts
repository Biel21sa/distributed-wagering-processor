import { WagerTransactionRequestedMessage } from "../domain/wager-transaction-requested.event.js";
import { MessageErrorType, MessageProcessingError } from "../domain/message-errors.js";


export function parseWagerMessage(
  body: string,
): WagerTransactionRequestedMessage {
  let parsed: unknown;

  try {
    parsed =
      JSON.parse(body);
  } catch {
    throw new MessageProcessingError(
      'Message body is not valid JSON',
      MessageErrorType.Permanent,
      'INVALID_JSON',
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null
  ) {
    throw new MessageProcessingError(
      'Message must be an object',
      MessageErrorType.Permanent,
      'INVALID_MESSAGE',
    );
  }

  const message =
    parsed as Partial<WagerTransactionRequestedMessage>;

  if (
    typeof message.messageId !==
      'string' ||
    typeof message.type !==
      'string' ||
    typeof message.occurredAt !==
      'string' ||
    !message.data
  ) {
    throw new MessageProcessingError(
      'Message does not match the expected schema',
      MessageErrorType.Permanent,
      'INVALID_MESSAGE_SCHEMA',
    );
  }

  if (
    message.type !==
    'WagerTransactionRequested'
  ) {
    throw new MessageProcessingError(
      `Unsupported message type: ${message.type}`,
      MessageErrorType.Permanent,
      'UNSUPPORTED_MESSAGE_TYPE',
    );
  }

  return message as WagerTransactionRequestedMessage;
}
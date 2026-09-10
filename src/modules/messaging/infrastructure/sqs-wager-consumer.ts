import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ProcessInboxMessageUseCase } from '../../inbox/application/process-inbox-message.use-case.js';
import { parseWagerMessage } from '../application/message-parser.js';
import { MessageProcessingError, MessageErrorType } from '../domain/message-errors.js';
import { sqsClient } from './sqs.client.js';

export const SHUTDOWN_TIMEOUT_MS = 25_000;

export class SqsWagerConsumer {
  private running = false;
  private inFlight = 0;

  constructor(
    private readonly processor:
      ProcessInboxMessageUseCase,
    private readonly client: SQSClient = sqsClient,
  ) { }

  async start(): Promise<void> {
    this.running = true;

    while (this.running) {
      try {
        await this.poll();
      } catch (error) {
        console.error(
          'SQS polling error',
          error,
        );

        await this.sleep(1000);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async shutdown(): Promise<void> {
    await this.stop();

    await Promise.race([
      this.drain(),
      this.sleep(SHUTDOWN_TIMEOUT_MS),
    ]);
  }

  async drain(): Promise<void> {
    while (this.inFlight > 0) {
      await this.sleep(100);
    }
  }

  private async poll(): Promise<void> {
    const visibilityTimeout = Number(
      process.env.SQS_VISIBILITY_TIMEOUT ?? 30,
    );

    const waitTimeSeconds = Number(
      process.env.SQS_WAIT_TIME_SECONDS ?? 20,
    );

    const response =
      await this.client.send(
        new ReceiveMessageCommand({
          QueueUrl:
            process.env
              .SQS_WAGER_QUEUE_URL!,

          MaxNumberOfMessages: 10,

          WaitTimeSeconds: waitTimeSeconds,

          VisibilityTimeout: visibilityTimeout,

          MessageAttributeNames: [
            'All',
          ],
        }),
      );

    const messages =
      response.Messages ?? [];

    for (const message of messages) {
      await this.handleMessage(
        message,
      );
    }
  }

  async processMessage(
    message: {
      MessageId?: string;
      Body?: string;
      ReceiptHandle?: string;
    },
  ): Promise<void> {
    await this.handleMessage(message);
  }

  private async handleMessage(
    message: {
      MessageId?: string;
      Body?: string;
      ReceiptHandle?: string;
    },
  ): Promise<void> {
    this.inFlight += 1;
    const receiptHandle =
      message.ReceiptHandle;

    try {
      if (
        !message.Body ||
        !receiptHandle
      ) {
        return;
      }

      const parsed =
        parseWagerMessage(
          message.Body,
        );

      await this.processor.execute(
        parsed,
      );

      await this.deleteMessage(
        receiptHandle,
      );
    } catch (
    error
    ) {
      if (
        error instanceof
        MessageProcessingError
      ) {
        if (
          error.type ===
          MessageErrorType.Business
        ) {
          if (receiptHandle) {
            await this.deleteMessage(
              receiptHandle,
            );
          }

          return;
        }

        if (
          error.type ===
          MessageErrorType.Permanent
        ) {
          // Não tentamos processar novamente.
          // A mensagem será encaminhada para DLQ
          // conforme a política de redrive.
          return;
        }

        if (
          error.type ===
          MessageErrorType.Transient
        ) {
          // Sem ACK.
          // SQS irá disponibilizar novamente.
          return;
        }
      }

      // Erros desconhecidos são tratados
      // como transitórios.
      throw error;
    } finally {
      this.inFlight -= 1;
    }
  }

  private async deleteMessage(
    receiptHandle: string,
  ): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl:
          process.env
            .SQS_WAGER_QUEUE_URL!,

        ReceiptHandle:
          receiptHandle,
      }),
    );
  }

  private sleep(
    milliseconds: number,
  ): Promise<void> {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}
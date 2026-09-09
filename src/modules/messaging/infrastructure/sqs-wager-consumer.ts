import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ProcessInboxMessageUseCase } from '../../inbox/application/process-inbox-message.use-case.js';
import {
  classifyMessageError,
  PermanentMessageError,
} from '../application/message-error.js';
import { validateWagerMessage } from '../application/validate-wager-message.js';
import { sqsClient } from './sqs.client.js';

export class SqsWagerConsumer implements OnModuleInit, OnModuleDestroy {
  private running = false;

  constructor(
    private readonly processor:
      ProcessInboxMessageUseCase,
    private readonly client: SQSClient = sqsClient,
  ) {}

  onModuleInit(): void {
    if (process.env.SQS_WAGER_QUEUE_URL) {
      void this.start();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async start(): Promise<void> {
    this.running = true;

    while (this.running) {
      try {
        const response =
          await this.client.send(
            new ReceiveMessageCommand({
            QueueUrl:
              process.env
                .SQS_WAGER_QUEUE_URL!,

            MaxNumberOfMessages: 10,

            WaitTimeSeconds: 20,

            VisibilityTimeout: 30,

            MessageAttributeNames: [
              'All',
            ],
            }),
          );

        const messages =
          response.Messages ?? [];

        for (const message of messages) {
          try {
            await this.processMessage(message);
          } catch (error) {
            console.error(
              `SQS message left for redelivery (${classifyMessageError(error)})`,
              error,
            );
          }
        }
      } catch (error) {
        console.error('SQS receive failed; retrying', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async processMessage(
    message: {
      MessageId?: string;
      Body?: string;
      ReceiptHandle?: string;
    },
  ): Promise<void> {
    if (
      !message.MessageId ||
      !message.Body ||
      !message.ReceiptHandle
    ) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(message.Body);
    } catch {
      throw new PermanentMessageError('Invalid JSON message body');
    }

    await this.processor.execute(
      validateWagerMessage(parsed),
    );

    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl:
          process.env
            .SQS_WAGER_QUEUE_URL!,

        ReceiptHandle:
          message.ReceiptHandle,
      }),
    );
  }
}
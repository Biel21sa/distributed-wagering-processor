import {
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { sqsClient } from '../../messaging/infrastructure/sqs.client.js';

export class SqsOutboxPublisher {
  private readonly queueUrl =
    process.env.SQS_EVENTS_QUEUE_URL!;

  async publish(
    message: {
      id: string;
      aggregateId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl:
          this.queueUrl,

        MessageBody:
          JSON.stringify(
            message.payload,
          ),

        MessageGroupId:
          message.aggregateId,

        MessageDeduplicationId:
          message.id,
      }),
    );
  }
}
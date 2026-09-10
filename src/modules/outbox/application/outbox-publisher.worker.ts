import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { OutboxPublisherRepository } from './outbox-publisher-repository.port.js';
import { SqsOutboxPublisher } from '../infrastructure/sqs-outbox-publisher.js';

export const MAX_OUTBOX_ATTEMPTS = 10;

export class OutboxPublisherWorker {
  private running = false;

  constructor(
    private readonly em:
      EntityManager,

    private readonly repository:
      OutboxPublisherRepository,

    private readonly publisher:
      SqsOutboxPublisher,
  ) {}

  async start(): Promise<void> {
    this.running = true;

    while (this.running) {
      await this.processBatch();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async processBatch(): Promise<void> {
    let processed = false;

    await this.em.transactional(
      async (em) => {
        const messages =
          await this.repository.findPending(
            em,
            new Date(),
            10,
          );

        if (
          messages.length === 0
        ) {
          return;
        }

        processed = true;

        for (const message of messages) {
          if (message.attempts >= MAX_OUTBOX_ATTEMPTS) {
            continue;
          }

          try {
            await this.publisher.publish({
              id: message.id,

              aggregateId:
                message.aggregateId,

              payload:
                message.payload,
            });

            await this.repository
              .markPublished(
                em,
                message.id,
                new Date(),
              );
          } catch {
            message.scheduleRetry(
              new Date(),
            );

            await this.repository
              .markRetry(
                em,
                message,
              );
          }
        }
      },
      {
        clear: true,
      },
    );

    if (!processed) {
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 1000),
      );
    }
  }
}
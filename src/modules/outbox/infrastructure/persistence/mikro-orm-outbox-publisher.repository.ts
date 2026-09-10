import {
  EntityManager,
  LockMode,
} from '@mikro-orm/postgresql';
import { OutboxPublisherRepository } from '../../application/outbox-publisher-repository.port.js';
import { OutboxMessage } from '../../domain/outbox-message.js';
import { OutboxMessageEntity } from './outbox-message.entity.js';
import { OutboxMessageMapper } from './outbox-message.mapper.js';
import { MAX_OUTBOX_ATTEMPTS } from '../../application/outbox-publisher.worker.js';

export class MikroOrmOutboxPublisherRepository
  implements OutboxPublisherRepository
{
  async findPending(
    em: EntityManager,
    now: Date,
    limit: number,
  ): Promise<OutboxMessage[]> {
    const entities =
      await em.find(
        OutboxMessageEntity,
        {
          publishedAt: null,

          attempts: {
            $lt: MAX_OUTBOX_ATTEMPTS,
          },

          $or: [
            {
              nextAttemptAt:
                null,
            },
            {
              nextAttemptAt: {
                $lte: now,
              },
            },
          ],
        },
        {
          limit,

          orderBy: {
            occurredAt: 'asc',
          },

          lockMode:
            LockMode.PESSIMISTIC_PARTIAL_WRITE,
        },
      );

    return entities.map(
      OutboxMessageMapper.toDomain,
    );
  }

  async markPublished(
    em: EntityManager,
    messageId: string,
    at: Date,
  ): Promise<void> {
    const entity =
      await em.findOneOrFail(
        OutboxMessageEntity,
        {
          id: messageId,
        },
      );

    entity.publishedAt = at;
  }

  async markRetry(
    em: EntityManager,
    message: OutboxMessage,
  ): Promise<void> {
    const entity =
      await em.findOneOrFail(
        OutboxMessageEntity,
        {
          id: message.id,
        },
      );

    entity.attempts =
      message.attempts;

    entity.nextAttemptAt =
      message.nextAttemptAt
      ?? null;
  }
}
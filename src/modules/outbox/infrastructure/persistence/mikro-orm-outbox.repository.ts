import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { OutboxRepository } from '../../application/outbox-repository.port.js';
import { OutboxMessage } from '../../domain/outbox-message.js';
import { OutboxMessageMapper } from './outbox-message.mapper.js';

export class MikroOrmOutboxRepository
  implements OutboxRepository
{
  async save(
    em: EntityManager,
    message: OutboxMessage,
  ): Promise<void> {
    const entity =
      OutboxMessageMapper.toEntity(
        message,
      );

    em.persist(entity);
  }
}
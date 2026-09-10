import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { OutboxMessage } from '../domain/outbox-message.js';

export const OUTBOX_PUBLISHER_REPOSITORY =
  Symbol(
    'OUTBOX_PUBLISHER_REPOSITORY',
  );

export interface OutboxPublisherRepository {
  findPending(
    em: EntityManager,
    now: Date,
    limit: number,
  ): Promise<OutboxMessage[]>;

  markPublished(
    em: EntityManager,
    messageId: string,
    at: Date,
  ): Promise<void>;

  markRetry(
    em: EntityManager,
    message: OutboxMessage,
  ): Promise<void>;
}
import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { OutboxMessage } from '../domain/outbox-message.js';

export const OUTBOX_REPOSITORY =
  Symbol('OUTBOX_REPOSITORY');

export interface OutboxRepository {
  save(
    em: EntityManager,
    message: OutboxMessage,
  ): Promise<void>;
}
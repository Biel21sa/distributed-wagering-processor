import {
  EntityManager,
} from '@mikro-orm/postgresql';

export const INBOX_REPOSITORY =
  Symbol('INBOX_REPOSITORY');

export interface InboxRepository {
  exists(
    em: EntityManager,
    consumerName: string,
    messageId: string,
  ): Promise<boolean>;

  save(
    em: EntityManager,
    props: {
      messageId: string;
      consumerName: string;
      payloadHash: string;
      receivedAt: Date;
    },
  ): Promise<void>;

  markProcessed(
    em: EntityManager,
    consumerName: string,
    messageId: string,
    processedAt: Date,
  ): Promise<void>;
}
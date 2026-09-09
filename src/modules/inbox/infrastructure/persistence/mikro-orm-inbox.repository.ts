import { EntityManager } from "@mikro-orm/core";
import { InboxRepository } from "../../application/inbox-repository.port.js";
import { InboxMessageEntity } from "./inbox-message.entity.js";


export class MikroOrmInboxRepository
  implements InboxRepository
{
  async exists(
    em: EntityManager,
    consumerName: string,
    messageId: string,
  ): Promise<boolean> {
    const entity =
      await em.findOne(
        InboxMessageEntity,
        {
          consumerName,
          messageId,
        },
      );

    return !!entity;
  }

  async save(
    em: EntityManager,
    props: {
      messageId: string;
      consumerName: string;
      payloadHash: string;
      receivedAt: Date;
    },
  ): Promise<void> {
    const entity =
      new InboxMessageEntity();

    entity.id =
      crypto.randomUUID();

    entity.messageId =
      props.messageId;

    entity.consumerName =
      props.consumerName;

    entity.payloadHash =
      props.payloadHash;

    entity.receivedAt =
      props.receivedAt;

    entity.processedAt = null;

    em.persist(entity);
  }

  async markProcessed(
    em: EntityManager,
    consumerName: string,
    messageId: string,
    processedAt: Date,
  ): Promise<void> {
    const entity =
      await em.findOne(
        InboxMessageEntity,
        {
          consumerName,
          messageId,
        },
      );

    if (!entity) {
      throw new Error(
        'Inbox message not found',
      );
    }

    entity.processedAt =
      processedAt;
  }
}
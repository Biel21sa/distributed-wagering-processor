import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WagerTransactionRequestedMessage } from '../../messaging/domain/wager-transaction-requested.event.js';
import { calculatePayloadHash } from '../../wagering/application/payload-hash.js';
import { ProcessWagerTransactionUseCase } from '../../wagering/application/process-wager-transaction.use-case.js';
import {
  getUniqueViolationConstraint,
  isUniqueViolation,
} from '../../../shared/infrastructure/database/postgres-error.js';
import { InboxRepository } from './inbox-repository.port.js';

export class ProcessInboxMessageUseCase {
  constructor(
    private readonly inboxRepository:
      InboxRepository,

    private readonly processWager:
      ProcessWagerTransactionUseCase,

    private readonly em:
      EntityManager,
  ) {}

  async execute(
    message:
      WagerTransactionRequestedMessage,
  ) {
    try {
      return await this.em.transactional(
        async (em) => {
        const consumerName =
          'wager-transaction-consumer';

        const alreadyProcessed =
          await this.inboxRepository.exists(
            em,
            consumerName,
            message.messageId,
          );

        if (alreadyProcessed) {
          return undefined;
        }

        const payloadHash =
          calculatePayloadHash(
            message.data,
          );

        await this.inboxRepository.save(
          em,
          {
            messageId:
              message.messageId,

            consumerName,

            payloadHash,

            receivedAt:
              new Date(
                message.occurredAt,
              ),
          },
        );

          await em.flush();

        const result = await this.processWager
          .execute({
            providerId:
              message.data.providerId,

            externalTransactionId:
              message.data
                .externalTransactionId,

            idempotencyKey:
              message.data
                .idempotencyKey,

            payloadHash,

            playerId:
              message.data.playerId,

            walletId:
              message.data.walletId,

            roundId:
              message.data.roundId,

            gameId:
              message.data.gameId,

            kind:
              message.data.kind,

            money:
              message.data.money,

            referenceExternalTransactionId:
              message.data
                .referenceExternalTransactionId,
          });

        await this.inboxRepository
          .markProcessed(
            em,
            consumerName,
            message.messageId,
            new Date(),
          );

        return result;
      },
      {
        clear: true,
      },
      );
    } catch (error) {
      const constraint =
        getUniqueViolationConstraint(error);

      if (
        isUniqueViolation(error) &&
        (constraint === undefined ||
        constraint === 'uq_inbox_consumer_message' ||
        constraint === 'uq_wager_provider_external_id' ||
        constraint === 'uq_wager_idempotency_key')
      ) {
        const em = this.em.fork();
        if (
          await this.inboxRepository.exists(
            em,
            'wager-transaction-consumer',
            message.messageId,
          )
        ) {
          return undefined;
        }
      }

      throw error;
    }
  }
}
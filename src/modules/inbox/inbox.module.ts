import {
  Module,
} from '@nestjs/common';

import {
  MikroOrmModule,
} from '@mikro-orm/nestjs';
import { INBOX_REPOSITORY } from './application/inbox-repository.port.js';
import { ProcessInboxMessageUseCase } from './application/process-inbox-message.use-case.js';
import { InboxMessageEntity } from './infrastructure/persistence/inbox-message.entity.js';
import { MikroOrmInboxRepository } from './infrastructure/persistence/mikro-orm-inbox.repository.js';
import { WageringModule } from '../wagering/wagering.module.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { ProcessWagerTransactionUseCase } from '../wagering/application/process-wager-transaction.use-case.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      InboxMessageEntity,
    ]),
    WageringModule,
  ],

  providers: [
    {
      provide:
        INBOX_REPOSITORY,

      useClass:
        MikroOrmInboxRepository,
    },

    {
      provide: ProcessInboxMessageUseCase,
      inject: [INBOX_REPOSITORY, ProcessWagerTransactionUseCase, EntityManager],
      useFactory: (
        inboxRepository,
        processWager,
        em,
      ) => new ProcessInboxMessageUseCase(inboxRepository, processWager, em),
    },
  ],

  exports: [
    INBOX_REPOSITORY,
    ProcessInboxMessageUseCase,
  ],
})
export class InboxModule {}
import {
  Module,
} from '@nestjs/common';
import { InboxModule } from '../inbox/inbox.module.js';
import { ProcessInboxMessageUseCase } from '../inbox/application/process-inbox-message.use-case.js';
import { SqsWagerConsumer } from './infrastructure/sqs-wager-consumer.js';

@Module({
  imports: [InboxModule],
  providers: [
    {
      provide: SqsWagerConsumer,
      inject: [ProcessInboxMessageUseCase],
      useFactory: (processor: ProcessInboxMessageUseCase) =>
        new SqsWagerConsumer(processor),
    },
  ],
  exports: [SqsWagerConsumer],
})
export class MessagingModule {}
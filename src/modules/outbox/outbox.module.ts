import {
    Module,
} from '@nestjs/common';

import {
    MikroOrmModule,
} from '@mikro-orm/nestjs';
import { OUTBOX_REPOSITORY } from './application/outbox-repository.port.js';
import { MikroOrmOutboxRepository } from './infrastructure/persistence/mikro-orm-outbox.repository.js';
import { OutboxMessageEntity } from './infrastructure/persistence/outbox-message.entity.js';
import { OUTBOX_PUBLISHER_REPOSITORY } from './application/outbox-publisher-repository.port.js';
import { MikroOrmOutboxPublisherRepository } from './infrastructure/persistence/mikro-orm-outbox-publisher.repository.js';

@Module({
    imports: [
        MikroOrmModule.forFeature([
            OutboxMessageEntity,
        ]),
    ],

    providers: [
        {
            provide:
                OUTBOX_REPOSITORY,

            useClass:
                MikroOrmOutboxRepository,
        },

        {
            provide:
                OUTBOX_PUBLISHER_REPOSITORY,

            useClass:
                MikroOrmOutboxPublisherRepository,
        },
    ],

    exports: [
        OUTBOX_REPOSITORY,
    ],
})
export class OutboxModule { }
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from '../mikro-orm.config.js';
import { WalletModule } from './modules/wallet/wallet.module.js';
import { WageringModule } from './modules/wagering/wagering.module.js';
import { InboxModule } from './modules/inbox/inbox.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MikroOrmModule.forRoot(mikroOrmConfig),

    WalletModule,
    WageringModule,
    InboxModule,
    MessagingModule,
    OutboxModule,
  ],
})
export class AppModule { }
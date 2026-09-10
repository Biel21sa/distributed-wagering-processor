import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from '../mikro-orm.config.js';
import { WalletModule } from './modules/wallet/wallet.module.js';
import { WageringModule } from './modules/wagering/wagering.module.js';
import { InboxModule } from './modules/inbox/inbox.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { CorrelationIdMiddleware } from './shared/infrastructure/http/correlation-id.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MikroOrmModule.forRoot({
      ...mikroOrmConfig,
      // Collect entity classes from each module's forFeature() registration.
      // This guarantees the repository providers resolve metadata against the
      // exact class references they import, which folder-based discovery does
      // not reliably do under the vitest test runner.
      autoLoadEntities: true,
    }),

    WalletModule,
    WageringModule,
    InboxModule,
    MessagingModule,
    OutboxModule,
    HealthModule,
  ],
})
export class AppModule
  implements NestModule
{
  configure(
    consumer: MiddlewareConsumer,
  ) {
    consumer.apply(
      CorrelationIdMiddleware,
    ).forRoutes('*');
  }
}
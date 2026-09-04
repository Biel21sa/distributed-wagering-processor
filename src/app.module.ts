import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from '../mikro-orm.config.js';
import { WalletModule } from './modules/wallet/wallet.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MikroOrmModule.forRoot(mikroOrmConfig),

    WalletModule,
  ],
})
export class AppModule {}
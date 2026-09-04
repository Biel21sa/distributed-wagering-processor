import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WalletEntity } from './infrastructure/persistence/wallet.entity.js';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      WalletEntity,
    ]),
  ],
})
export class WalletModule {}
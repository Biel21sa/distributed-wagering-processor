import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WagerTransactionEntity } from './infrastructure/persistence/wager-transaction.entity.js';


@Module({
  imports: [
    MikroOrmModule.forFeature([
      WagerTransactionEntity,
    ]),
  ],
})
export class WageringModule {}
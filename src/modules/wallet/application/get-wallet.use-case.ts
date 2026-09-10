import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WalletEntity } from '../infrastructure/persistence/wallet.entity.js';

export class GetWalletUseCase {
  constructor(
    private readonly em:
      EntityManager,
  ) {}

  async execute(
    walletId: string,
  ) {
    const wallet =
      await this.em.findOne(
        WalletEntity,
        {
          id: walletId,
        },
      );

    if (!wallet) {
      return null;
    }

    return {
      id: wallet.id,

      playerId:
        wallet.playerId,

      balance: {
        amount:
          wallet.balance,

        currency:
          wallet.currency,
      },

      version:
        wallet.version,
    };
  }
}
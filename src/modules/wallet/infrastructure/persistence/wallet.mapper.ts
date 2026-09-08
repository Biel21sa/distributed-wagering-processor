import { Money } from "../../domain/money.js";
import { Wallet, WalletState } from "../../domain/wallet.js";
import { WalletEntity } from "./wallet.entity.js";


export class WalletMapper {
  static toDomain(
    entity: WalletEntity,
  ): Wallet {
    const state: WalletState = {
      id: entity.id,
      playerId: entity.playerId,
      currency: entity.currency,

      balance: Money.from({
        amount: entity.balance,
        currency: entity.currency,
      }),

      version: entity.version,

      createdAt:
        entity.createdAt,

      updatedAt:
        entity.updatedAt,
    };

    return Wallet.rehydrate(state);
  }

  static updateEntity(
    entity: WalletEntity,
    wallet: Wallet,
  ): void {
    entity.balance =
      wallet.balance.toJSON().amount;

    entity.version =
      wallet.version;

    entity.updatedAt =
      wallet.updatedAt;
  }
}
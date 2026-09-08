import { Wallet } from "../../../wallet/domain/wallet.js";

export const WALLET_REPOSITORY = Symbol(
  'WALLET_REPOSITORY',
);

export interface WalletRepository {
  findById(id: string): Promise<Wallet | null>;

  save(wallet: Wallet): Promise<void>;
}
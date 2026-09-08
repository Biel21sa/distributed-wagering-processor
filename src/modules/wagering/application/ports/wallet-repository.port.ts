import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { Wallet } from '../../../wallet/domain/wallet.js';

export const WALLET_REPOSITORY =
  Symbol('WALLET_REPOSITORY');

export interface WalletRepository {
  findById(
    em: EntityManager,
    id: string,
  ): Promise<Wallet | null>;

  findByIdForUpdate(
    em: EntityManager,
    id: string,
  ): Promise<Wallet | null>;

  save(
    em: EntityManager,
    wallet: Wallet,
  ): Promise<void>;
}
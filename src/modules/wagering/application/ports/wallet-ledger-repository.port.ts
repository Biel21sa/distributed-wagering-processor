import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { WalletLedgerEntry } from '../../../wallet/domain/wallet-ledger-entry.js';

export const WALLET_LEDGER_REPOSITORY =
  Symbol('WALLET_LEDGER_REPOSITORY');

export interface WalletLedgerRepository {
  save(
    em: EntityManager,
    entry: WalletLedgerEntry,
  ): Promise<void>;
}
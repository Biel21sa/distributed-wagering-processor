import { EntityManager } from "@mikro-orm/core";
import { WalletLedgerRepository } from "../../../wagering/application/ports/wallet-ledger-repository.port.js";
import { WalletLedgerEntry } from "../../domain/wallet-ledger-entry.js";
import { WalletLedgerEntryMapper } from "./wallet-ledger-entry.mapper.js";

export class MikroOrmWalletLedgerRepository
  implements WalletLedgerRepository
{
  async save(
    em: EntityManager,
    entry: WalletLedgerEntry,
  ): Promise<void> {
    const entity =
      WalletLedgerEntryMapper.toEntity(
        entry,
      );

    em.persist(entity);
  }
}
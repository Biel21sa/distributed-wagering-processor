import { WalletLedgerEntry } from "../../domain/wallet-ledger-entry.js";
import { WalletLedgerEntryEntity, LedgerDirectionEntity } from "./wallet-ledger-entry.entity.js";


export class WalletLedgerEntryMapper {
  static toEntity(
    entry: WalletLedgerEntry,
  ): WalletLedgerEntryEntity {
    const entity =
      new WalletLedgerEntryEntity();

    entity.id = entry.id;

    entity.walletId =
      entry.walletId;

    entity.transactionId =
      entry.transactionId;

    entity.direction =
      entry.direction === 'DEBIT'
        ? LedgerDirectionEntity.Debit
        : LedgerDirectionEntity.Credit;

    entity.amount =
      entry.money.toJSON().amount;

    entity.currency =
      entry.money.currency;

    entity.balanceBefore =
      entry.balanceBefore
        .toJSON()
        .amount;

    entity.balanceAfter =
      entry.balanceAfter
        .toJSON()
        .amount;

    entity.createdAt =
      entry.createdAt;

    return entity;
  }
}
import { LedgerDirection } from "../../wallet/domain/wallet-ledger-entry.js";

export function reversalDirection(
  originalDirection: LedgerDirection,
): LedgerDirection {
  return originalDirection ===
    LedgerDirection.Debit
    ? LedgerDirection.Credit
    : LedgerDirection.Debit;
}
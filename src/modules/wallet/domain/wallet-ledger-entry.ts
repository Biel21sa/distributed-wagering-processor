import { CurrencyMismatchError } from "../../../shared/domain/errors/money.error.js";
import { Money } from "./money.js";


export enum LedgerDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

export interface CreateLedgerEntryProps {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt?: Date;
}

export interface LedgerEntryState {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: Date;
}

export class WalletLedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly transactionId: string,
    public readonly direction: LedgerDirection,
    public readonly money: Money,
    public readonly balanceBefore: Money,
    public readonly balanceAfter: Money,
    public readonly createdAt: Date,
  ) {}

  static create(
    props: CreateLedgerEntryProps,
  ): WalletLedgerEntry {
    if (
      props.money.currency !==
      props.balanceBefore.currency
    ) {
      throw new CurrencyMismatchError(
        props.balanceBefore.currency,
        props.money.currency,
      );
    }

    if (
      props.money.currency !==
      props.balanceAfter.currency
    ) {
      throw new CurrencyMismatchError(
        props.balanceAfter.currency,
        props.money.currency,
      );
    }

    const expectedBalance =
      props.direction === LedgerDirection.Debit
        ? props.balanceBefore.subtract(props.money)
        : props.balanceBefore.add(props.money);

    if (!expectedBalance.equals(props.balanceAfter)) {
      throw new Error(
        'Ledger entry is not balanced',
      );
    }

    return new WalletLedgerEntry(
      props.id,
      props.walletId,
      props.transactionId,
      props.direction,
      props.money,
      props.balanceBefore,
      props.balanceAfter,
      props.createdAt ?? new Date(),
    );
  }

  static rehydrate(
    state: LedgerEntryState,
  ): WalletLedgerEntry {
    return new WalletLedgerEntry(
      state.id,
      state.walletId,
      state.transactionId,
      state.direction,
      state.money,
      state.balanceBefore,
      state.balanceAfter,
      state.createdAt,
    );
  }

  isBalanced(): boolean {
    const expectedBalance =
      this.direction === LedgerDirection.Debit
        ? this.balanceBefore.subtract(this.money)
        : this.balanceBefore.add(this.money);

    return expectedBalance.equals(
      this.balanceAfter,
    );
  }
}
import { MoneyProps } from "../../wallet/domain/money.js";
import { LedgerDirection } from "../../wallet/domain/wallet-ledger-entry.js";
import { IntegrationEvent, IntegrationEventProps } from "./integration-event.js";


export interface WalletBalanceChangedData {
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  walletVersion: number;
}

export class WalletBalanceChanged
  extends IntegrationEvent<WalletBalanceChangedData>
{
  readonly eventType =
    'WalletBalanceChanged';

  readonly version = 1;

  static from(
    props: IntegrationEventProps<WalletBalanceChangedData>,
  ): WalletBalanceChanged {
    return new WalletBalanceChanged(
      props,
    );
  }
}
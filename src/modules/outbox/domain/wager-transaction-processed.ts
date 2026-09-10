import { WagerTransactionKind } from "../../wagering/domain/wager-transaction-kind.js";
import { MoneyProps } from "../../wallet/domain/money.js";
import { IntegrationEvent, IntegrationEventProps } from "./integration-event.js";


export interface WagerTransactionProcessedData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: MoneyProps;
  balance: MoneyProps;
}

export class WagerTransactionProcessed
  extends IntegrationEvent<WagerTransactionProcessedData>
{
  readonly eventType =
    'WagerTransactionProcessed';

  readonly version = 1;

  static from(
    props: IntegrationEventProps<WagerTransactionProcessedData>,
  ): WagerTransactionProcessed {
    return new WagerTransactionProcessed(
      props,
    );
  }
}
import { FailureCode } from "../../wagering/domain/failure-code.js";
import { MoneyProps } from "../../wallet/domain/money.js";
import { IntegrationEvent, IntegrationEventProps } from "./integration-event.js";


export interface WagerTransactionRejectedData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  playerId: string;
  failureCode: FailureCode;
  balance: MoneyProps;
}

export class WagerTransactionRejected
  extends IntegrationEvent<WagerTransactionRejectedData>
{
  readonly eventType =
    'WagerTransactionRejected';

  readonly version = 1;

  static from(
    props: IntegrationEventProps<WagerTransactionRejectedData>,
  ): WagerTransactionRejected {
    return new WagerTransactionRejected(
      props,
    );
  }
}
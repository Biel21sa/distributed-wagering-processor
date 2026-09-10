import { IntegrationEvent, IntegrationEventProps } from "./integration-event.js";


export interface WagerTransactionPendingReferenceData {
  transactionId: string;
  providerId: string;
  externalTransactionId: string;
  walletId: string;
  referenceExternalTransactionId: string;
}

export class WagerTransactionPendingReference
  extends IntegrationEvent<WagerTransactionPendingReferenceData>
{
  readonly eventType =
    'WagerTransactionPendingReference';

  readonly version = 1;

  static from(
    props: IntegrationEventProps<WagerTransactionPendingReferenceData>,
  ): WagerTransactionPendingReference {
    return new WagerTransactionPendingReference(
      props,
    );
  }
}
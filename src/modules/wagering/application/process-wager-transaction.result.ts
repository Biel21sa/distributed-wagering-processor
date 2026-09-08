import { MoneyProps } from "../../wallet/domain/money.js";
import { FailureCode } from "../domain/failure-code.js";
import { WagerTransactionStatus } from "../domain/wager-transaction-status.js";

export interface ProcessWagerTransactionResult {
  transactionId: string;

  status: WagerTransactionStatus;

  balance: MoneyProps;

  idempotentReplay: boolean;

  failureCode?: FailureCode;
}
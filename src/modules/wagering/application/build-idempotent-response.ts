import { WagerTransaction } from "../domain/wager-transaction.js";

export function buildIdempotentResponse(
  transaction: WagerTransaction,
) {
  if (
    !transaction.responseBalance
  ) {
    throw new Error(
      `Transaction ${transaction.id} does not have an idempotent response snapshot`,
    );
  }

  return {
    transactionId:
      transaction.id,

    status:
      transaction.status,

    balance:
      transaction.responseBalance.toJSON(),

    idempotentReplay: true,

    failureCode:
      transaction.failureCode,
  };
}
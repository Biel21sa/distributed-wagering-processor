import { Migration } from '@mikro-orm/migrations';

export class Migration20260910050000 extends Migration {

  override name = 'Migration20260910050000';

  override up(): void | Promise<void> {
    // Add NEGATIVE_BALANCE_REVERSAL to the allowed failure codes. A reversal
    // (refund/rollback) that would drive the balance negative is rejected
    // with this code, which is distinct from INSUFFICIENT_FUNDS.
    this.addSql(`alter table "wager_transactions" drop constraint "wager_transactions_failure_code_check";`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_failure_code_check" check ("failure_code" in ('INVALID_TRANSACTION', 'INSUFFICIENT_FUNDS', 'CURRENCY_MISMATCH', 'REFERENCE_NOT_FOUND', 'REFERENCE_INVALID', 'INVALID_REFUND_REFERENCE', 'INVALID_ROLLBACK_REFERENCE', 'DUPLICATE_REVERSAL', 'NEGATIVE_BALANCE', 'NEGATIVE_BALANCE_REVERSAL', 'IDEMPOTENCY_CONFLICT', 'INTERNAL_ERROR'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "wager_transactions" drop constraint "wager_transactions_failure_code_check";`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_failure_code_check" check ("failure_code" in ('INVALID_TRANSACTION', 'INSUFFICIENT_FUNDS', 'CURRENCY_MISMATCH', 'REFERENCE_NOT_FOUND', 'REFERENCE_INVALID', 'INVALID_REFUND_REFERENCE', 'INVALID_ROLLBACK_REFERENCE', 'DUPLICATE_REVERSAL', 'NEGATIVE_BALANCE', 'IDEMPOTENCY_CONFLICT', 'INTERNAL_ERROR'));`);
  }

}

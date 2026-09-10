import { Migration } from '@mikro-orm/migrations';

export class Migration20260910040056 extends Migration {

  override name = 'Migration20260910040056';

  override up(): void | Promise<void> {
    this.addSql(`alter table "wager_transactions" add "reference_attempts" int not null default 0, add "reference_next_attempt_at" timestamptz null;`);
    this.addSql(`create unique index "uq_refund_reference" on "wager_transactions" ("reference_transaction_id") where "kind" = 'REFUND' and "reference_transaction_id" is not null;`);
    this.addSql(`create unique index "uq_rollback_reference" on "wager_transactions" ("reference_transaction_id") where "kind" = 'ROLLBACK' and "reference_transaction_id" is not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index if exists "uq_refund_reference";`);
    this.addSql(`drop index if exists "uq_rollback_reference";`);
    this.addSql(`alter table "wager_transactions" drop column "reference_attempts", drop column "reference_next_attempt_at";`);
  }

}

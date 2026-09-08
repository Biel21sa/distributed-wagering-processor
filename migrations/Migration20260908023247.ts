import { Migration } from '@mikro-orm/migrations';

export class Migration20260908023247 extends Migration {

  override name = 'Migration20260908023247';

  override up(): void | Promise<void> {
    this.addSql(`create table "wallet_ledger_entries" ("id" uuid not null, "wallet_id" uuid not null, "transaction_id" uuid not null, "direction" text not null, "amount" numeric(20,2) not null, "currency" varchar(3) not null, "balance_before" numeric(20,2) not null, "balance_after" numeric(20,2) not null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "idx_ledger_wallet_created_at" on "wallet_ledger_entries" ("wallet_id", "created_at");`);
    this.addSql(`alter table "wallet_ledger_entries" add constraint "uq_ledger_transaction_wallet" unique ("wallet_id", "transaction_id");`);
    this.addSql(`alter table "wallet_ledger_entries" add constraint "wallet_ledger_entries_direction_check" check ("direction" in ('DEBIT', 'CREDIT'));`);
    this.addSql(`ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "fk_ledger_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id");`)
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "wallet_ledger_entries" cascade;`);
    this.addSql(`ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT "fk_ledger_wallet";`)
  }

}

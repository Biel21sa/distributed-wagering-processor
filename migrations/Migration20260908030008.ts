import { Migration } from '@mikro-orm/migrations';

export class Migration20260908030008 extends Migration {

  override name = 'Migration20260908030008';

  override up(): void | Promise<void> {
    this.addSql(`create table "wager_transactions" ("id" uuid not null, "provider_id" varchar(255) not null, "external_transaction_id" varchar(255) not null, "idempotency_key" varchar(255) not null, "payload_hash" varchar(255) not null, "wallet_id" uuid not null, "player_id" uuid not null, "round_id" varchar(255) not null, "game_id" varchar(255) not null, "kind" text not null, "amount" numeric(20,2) not null, "currency" varchar(3) not null, "reference_external_transaction_id" varchar(255) null, "created_at" timestamptz not null, "status" text not null, "reference_transaction_id" varchar(255) null, "failure_code" text null, "processed_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "idx_wager_wallet" on "wager_transactions" ("wallet_id");`);
    this.addSql(`alter table "wager_transactions" add constraint "uq_wager_provider_external_id" unique ("provider_id", "external_transaction_id");`);
    this.addSql(`alter table "wager_transactions" add constraint "uq_wager_idempotency_key" unique ("idempotency_key");`);
    this.addSql(`alter table "wallet_ledger_entries" add constraint "fk_ledger_transaction" foreign key ("transaction_id") references "wager_transactions" ("id");`);

    this.addSql(`alter table "wallets" drop constraint "chk_wallet_balance_non_negative";`);
    this.addSql(`alter table "wallets" drop constraint "chk_wallet_version_positive";`);

    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_kind_check" check ("kind" in ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK'));`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_status_check" check ("status" in ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED'));`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_failure_code_check" check ("failure_code" in ('INVALID_TRANSACTION', 'INSUFFICIENT_FUNDS', 'CURRENCY_MISMATCH', 'REFERENCE_NOT_FOUND', 'REFERENCE_INVALID', 'INVALID_REFUND_REFERENCE', 'INVALID_ROLLBACK_REFERENCE', 'DUPLICATE_REVERSAL', 'NEGATIVE_BALANCE', 'IDEMPOTENCY_CONFLICT', 'INTERNAL_ERROR'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "wager_transactions" cascade;`);

    this.addSql(`alter table "wallets" add constraint "chk_wallet_balance_non_negative" check (balance >= 0);`);
    this.addSql(`alter table "wallets" add constraint "chk_wallet_version_positive" check (version >= 1);`);
  }

}

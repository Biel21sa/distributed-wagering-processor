import { Migration } from '@mikro-orm/migrations';

export class Migration20260908022602 extends Migration {

  override name = 'Migration20260908022602';

  override up(): void | Promise<void> {
    this.addSql(`create table "wallets" ("id" uuid not null, "player_id" uuid not null, "currency" varchar(3) not null, "balance" numeric(20,2) not null, "version" int not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "idx_wallet_player" on "wallets" ("player_id");`);
    this.addSql(`alter table "wallets" add constraint "uq_wallet_player_currency" unique ("player_id", "currency");`);
    this.addSql(`alter table "wallets" add constraint "chk_wallet_balance_non_negative" check ("balance" >= 0);`);
    this.addSql(`alter table "wallets" add constraint "chk_wallet_version_positive" check ("version" >= 1);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "wallets" drop constraint "uq_wallet_player_currency";`);
    this.addSql(`alter table "wallets" drop constraint "chk_wallet_balance_non_negative";`);
    this.addSql(`alter table "wallets" drop constraint "chk_wallet_version_positive";`);
    this.addSql(`drop index "idx_wallet_player";`);
    this.addSql(`drop table "wallets";`);
  }

}

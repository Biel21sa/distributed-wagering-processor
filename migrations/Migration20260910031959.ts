import { Migration } from '@mikro-orm/migrations';

export class Migration20260910031959 extends Migration {

  override name = 'Migration20260910031959';

  override up(): void | Promise<void> {
    this.addSql(`create table "outbox_messages" ("id" uuid not null, "aggregate_id" uuid not null, "event_type" varchar(255) not null, "payload" jsonb not null, "occurred_at" timestamptz not null, "attempts" int not null, "next_attempt_at" timestamptz null, "published_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "idx_outbox_pending" on "outbox_messages" ("published_at", "next_attempt_at", "occurred_at");`);

  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "outbox_messages" cascade;`);

  }

}

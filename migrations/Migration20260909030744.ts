import { Migration } from '@mikro-orm/migrations';

export class Migration20260909030744 extends Migration {

  override name = 'Migration20260909030744';

  override up(): void | Promise<void> {
    this.addSql(`create table "inbox_messages" ("id" uuid not null, "message_id" varchar(255) not null, "consumer_name" varchar(255) not null, "payload_hash" varchar(255) not null, "received_at" timestamptz not null, "processed_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "idx_inbox_processed_at" on "inbox_messages" ("processed_at");`);
    this.addSql(`alter table "inbox_messages" add constraint "uq_inbox_consumer_message" unique ("consumer_name", "message_id");`);

  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "inbox_messages" cascade;`);
  }

}

import { Migration } from '@mikro-orm/migrations';

export class Migration20260908041906 extends Migration {

  override name = 'Migration20260908041906';

  override up(): void | Promise<void> {
    this.addSql(`alter table "wager_transactions" add "response_balance_amount" numeric(20,2) null, add "response_balance_currency" varchar(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "wager_transactions" drop column "response_balance_amount", drop column "response_balance_currency";`);
  }

}

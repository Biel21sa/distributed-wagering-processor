import { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestOrm } from '../support/test-bootstrap.js';

// Proves the test database can be built from the migrations alone, with no
// schema generator or manual DDL. This demonstrates a reproducible
// environment: a clean database + `migrator.up()` yields the full schema.
describe('migrations reproducibility', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await createTestOrm();

    // Start from a pristine schema so the only source of DDL is the
    // migration files themselves. Dropping and recreating the public schema
    // wipes every table (including the migrations bookkeeping table), so the
    // subsequent migrator.up() has to build everything from scratch.
    const connection = orm.em.getConnection();
    await connection.execute('DROP SCHEMA public CASCADE');
    await connection.execute('CREATE SCHEMA public');

    await orm.migrator.up();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('creates every required table from the migrations only', async () => {
    const rows = await orm.em.getConnection().execute<{ tablename: string }[]>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'`,
    );

    const tables = rows.map((row) => row.tablename);

    for (const expected of [
      'wallets',
      'wager_transactions',
      'wallet_ledger_entries',
      'inbox_messages',
      'outbox_messages',
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it('records the applied migrations and leaves none pending', async () => {
    // The migrator persists applied migrations in its bookkeeping table.
    const applied = await orm.em.getConnection().execute<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM mikro_orm_migrations`,
    );
    expect(Number(applied[0].count)).toBeGreaterThan(0);

    // Running the migrator again must be a no-op: everything is already
    // applied, so nothing new should be executed.
    const rerun = await orm.migrator.up();
    expect(rerun).toHaveLength(0);
  });
});

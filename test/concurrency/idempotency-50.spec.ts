import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import {
  ProcessWagerTransactionInput,
  ProcessWagerTransactionUseCase,
} from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { FailureCode } from '../../src/modules/wagering/domain/failure-code.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../src/modules/wagering/domain/wager-transaction-status.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';
const payloadHash = 'hash-provider-a-bet-50-25';

describe('persistent wager idempotency', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await initializeOrm();
    await orm.migrator.up();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(WalletLedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('processes the first BET and stores its response snapshot', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager(betInput(wallet.id, 'bet-123', '25.00'));

    expect(result).toMatchObject({
      status: WagerTransactionStatus.Processed,
      balance: { amount: '75.00', currency },
      idempotentReplay: false,
    });

    const transaction = await orm.em.fork().findOneOrFail(WagerTransactionEntity, {
      id: result.transactionId,
    });
    expect(transaction.payloadHash).toBe(payloadHash);
    expect(transaction.responseBalanceAmount).toBe('75.00');
    expect(transaction.responseBalanceCurrency).toBe(currency);
  });

  it('replays the same operation without a second debit, ledger, or transaction', async () => {
    const wallet = await createWallet('100.00');
    const input = betInput(wallet.id, 'bet-123', '25.00');
    const first = await processWager(input);
    const replay = await processWager(input);

    expect(replay).toEqual({
      transactionId: first.transactionId,
      status: WagerTransactionStatus.Processed,
      balance: { amount: '75.00', currency },
      idempotentReplay: true,
      failureCode: undefined,
    });
    expect(await orm.em.fork().count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
    expect(await orm.em.fork().count(WagerTransactionEntity, { idempotencyKey: input.idempotencyKey })).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
  });

  it('rejects a different payload for an already-used idempotency key', async () => {
    const wallet = await createWallet('100.00');
    await processWager(betInput(wallet.id, 'bet-123', '25.00'));

    await expect(
      processWager({
        ...betInput(wallet.id, 'bet-124', '50.00'),
        idempotencyKey: 'provider-a:bet-123',
        payloadHash: 'different-payload-hash',
      }),
    ).rejects.toMatchObject({ code: FailureCode.IdempotencyConflict });

    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect(await orm.em.fork().count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
  });

  it('returns 50 successful responses with exactly one debit and one transaction', async () => {
    const wallet = await createWallet('100.00');
    const input = betInput(wallet.id, 'bet-50', '25.00');
    const requests = Array.from({ length: 50 }, () => processWager(input));
    const results = await Promise.all(requests);

    const processed = results.filter(
      (result) => result.status === WagerTransactionStatus.Processed,
    );

    expect(processed).toHaveLength(50);
    expect(processed.filter((result) => !result.idempotentReplay)).toHaveLength(1);
    expect(processed.filter((result) => result.idempotentReplay)).toHaveLength(49);
    expect(new Set(processed.map((result) => result.transactionId)).size).toBe(1);
    expect(processed.every((result) => result.balance.amount === '75.00')).toBe(true);

    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    const em = orm.em.fork();
    expect(await em.count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
    expect(await em.count(WagerTransactionEntity, { idempotencyKey: input.idempotencyKey })).toBe(1);

    const ledger = await em.findOneOrFail(WalletLedgerEntryEntity, { walletId: wallet.id });
    expect(ledger).toMatchObject({
      direction: 'DEBIT',
      amount: '25.00',
      balanceBefore: '100.00',
      balanceAfter: '75.00',
    });
  });

  it('replays from PostgreSQL after the application ORM is restarted', async () => {
    const wallet = await createWallet('100.00');
    const input = betInput(wallet.id, 'bet-restart', '25.00');
    const first = await processWager(input);

    await orm.close(true);
    orm = await initializeOrm();

    const replay = await processWager(input);
    expect(replay).toMatchObject({
      transactionId: first.transactionId,
      status: WagerTransactionStatus.Processed,
      balance: { amount: '75.00', currency },
      idempotentReplay: true,
    });
    expect(await orm.em.fork().count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
  });

  it('keeps one transaction and one ledger across two ORM instances', async () => {
    const wallet = await createWallet('100.00');
    const input = betInput(wallet.id, 'bet-two-instances', '25.00');
    const instanceA = await initializeOrm();
    const instanceB = await initializeOrm();

    const [resultA, resultB] = await Promise.all([
      processWagerWithOrm(instanceA, input),
      processWagerWithOrm(instanceB, input),
    ]);

    const results = [resultA, resultB];
    expect(results.filter((result) => !result.idempotentReplay)).toHaveLength(1);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(new Set(results.map((result) => result.transactionId)).size).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect(await orm.em.fork().count(WagerTransactionEntity, { idempotencyKey: input.idempotencyKey })).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);

    await instanceA.close(true);
    await instanceB.close(true);
  });

  it('has the required PostgreSQL uniqueness constraints', async () => {
    const rows = await orm.em.getConnection().execute<{ constraint_name: string }[]>(
      `select constraint_name
       from information_schema.table_constraints
       where table_name = 'wager_transactions'
         and constraint_name in ('uq_wager_idempotency_key', 'uq_wager_provider_external_id')`,
    );

    expect(rows.map((row) => row.constraint_name).sort()).toEqual([
      'uq_wager_idempotency_key',
      'uq_wager_provider_external_id',
    ]);
  });

  async function createWallet(balance: string): Promise<WalletEntity> {
    const em = orm.em.fork();
    const wallet = em.create(WalletEntity, {
      id: randomUUID(),
      playerId: randomUUID(),
      currency,
      balance,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    em.persist(wallet);
    await em.flush();
    return wallet;
  }

  async function findWallet(id: string): Promise<WalletEntity> {
    return orm.em.fork().findOneOrFail(WalletEntity, { id });
  }

  async function processWager(input: ProcessWagerTransactionInput) {
    return processWagerWithOrm(orm, input);
  }

  async function processWagerWithOrm(
    ormInstance: MikroORM,
    input: ProcessWagerTransactionInput,
  ) {
    const em = ormInstance.em.fork();
    return new ProcessWagerTransactionUseCase(
      new MikroOrmWalletRepository(),
      new MikroOrmWagerTransactionRepository(em),
      new MikroOrmWalletLedgerRepository(),
      em,
    ).execute(input);
  }

  async function initializeOrm(): Promise<MikroORM> {
    return MikroORM.init({
      ...mikroOrmConfig,
      entities: [WalletEntity, WalletLedgerEntryEntity, WagerTransactionEntity],
    });
  }

  function betInput(
    walletId: string,
    externalTransactionId: string,
    amount: string,
  ): ProcessWagerTransactionInput {
    return {
      providerId: 'provider-a',
      externalTransactionId,
      idempotencyKey: `provider-a:${externalTransactionId}`,
      payloadHash,
      playerId: randomUUID(),
      walletId,
      roundId: 'round-1',
      gameId: 'game-1',
      kind: WagerTransactionKind.Bet,
      money: { amount, currency },
    };
  }
});

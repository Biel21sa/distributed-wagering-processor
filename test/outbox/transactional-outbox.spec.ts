import { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import { OutboxRepository } from '../../src/modules/outbox/application/outbox-repository.port.js';
import { OutboxPublisherRepository } from '../../src/modules/outbox/application/outbox-publisher-repository.port.js';
import { OutboxPublisherWorker } from '../../src/modules/outbox/application/outbox-publisher.worker.js';
import { OutboxMessage } from '../../src/modules/outbox/domain/outbox-message.js';
import { OutboxMessageEntity } from '../../src/modules/outbox/infrastructure/persistence/outbox-message.entity.js';
import { MikroOrmOutboxRepository } from '../../src/modules/outbox/infrastructure/persistence/mikro-orm-outbox.repository.js';
import { MikroOrmOutboxPublisherRepository } from '../../src/modules/outbox/infrastructure/persistence/mikro-orm-outbox-publisher.repository.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../src/modules/wagering/domain/wager-transaction-status.js';
import { ProcessWagerTransactionInput, ProcessWagerTransactionUseCase } from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';

describe('transactional outbox', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [WalletEntity, WalletLedgerEntryEntity, WagerTransactionEntity, OutboxMessageEntity],
    });
    await orm.migrator.up();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(OutboxMessageEntity, {});
    await em.nativeDelete(WalletLedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('commits wallet, ledger, transaction, and two BET outbox events atomically', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager(betInput(wallet.id, 'bet-outbox', '25.00'));
    const em = orm.em.fork();
    const events = await em.find(OutboxMessageEntity, { aggregateId: wallet.id });

    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect(await em.count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
    expect(result.status).toBe(WagerTransactionStatus.Processed);
    expect(await em.count(WagerTransactionEntity, { id: result.transactionId })).toBe(1);
    expect(events.map((event) => event.eventType).sort()).toEqual([
      'WagerTransactionProcessed',
      'WalletBalanceChanged',
    ]);
  });

  it('rolls back wallet, ledger, transaction, and outbox when Outbox persistence fails', async () => {
    const wallet = await createWallet('100.00');
    const failingOutbox: OutboxRepository = {
      save: async () => {
        throw new Error('SIMULATED_CRASH');
      },
    };

    await expect(
      processWager(betInput(wallet.id, 'bet-rollback', '25.00'), failingOutbox),
    ).rejects.toThrow('SIMULATED_CRASH');

    const em = orm.em.fork();
    expect((await findWallet(wallet.id)).balance).toBe('100.00');
    expect(await em.count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(0);
    expect(await em.count(WagerTransactionEntity)).toBe(0);
    expect(await em.count(OutboxMessageEntity)).toBe(0);
  });

  it('keeps the event pending when publishing fails before markPublished', async () => {
    const wallet = await createWallet('100.00');
    await processWager(betInput(wallet.id, 'bet-publisher-crash', '25.00'));
    const repository = new FailingMarkPublishedRepository(new MikroOrmOutboxPublisherRepository());
    const published: string[] = [];
    const worker = new OutboxPublisherWorker(
      orm.em.fork(),
      repository,
      { publish: async (message: { id: string; }) => { published.push(message.id); } } as never,
    );

    await worker.processBatch();

    const events = await orm.em.fork().find(OutboxMessageEntity, {
      id: { $in: published },
    });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.publishedAt === null)).toBe(true);
    expect(events.every((event) => event.attempts === 1)).toBe(true);
    expect(published).toHaveLength(2);
  });

  it('resumes both committed events after publisher A dies and publisher B takes over', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager(betInput(wallet.id, 'bet-publisher-restart', '25.00'));
    const em = orm.em.fork();
    const committedEvents = await em.find(OutboxMessageEntity, { aggregateId: wallet.id });

    expect(result.status).toBe(WagerTransactionStatus.Processed);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect(await em.count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(1);
    expect(await em.count(WagerTransactionEntity, { id: result.transactionId })).toBe(1);
    expect(committedEvents).toHaveLength(2);

    const publishedByA: string[] = [];
    const publisherA = new OutboxPublisherWorker(
      orm.em.fork(),
      new CrashAfterPublishRepository(new MikroOrmOutboxPublisherRepository()),
      {
        publish: async (message: { payload: Record<string, unknown> }) => {
          publishedByA.push(String(message.payload.eventType));
        },
      } as never,
    );

    await expect(publisherA.processBatch()).rejects.toThrow('SIMULATED_PUBLISHER_DEATH');

    const pendingAfterCrash = await orm.em.fork().find(OutboxMessageEntity, {
      aggregateId: wallet.id,
    });
    expect(pendingAfterCrash.every((event) => event.publishedAt === null)).toBe(true);
    expect(publishedByA).toEqual([
      'WagerTransactionProcessed',
    ]);

    const publishedByB: string[] = [];
    const publisherB = new OutboxPublisherWorker(
      orm.em.fork(),
      new MikroOrmOutboxPublisherRepository(),
      {
        publish: async (message: { payload: Record<string, unknown> }) => {
          publishedByB.push(String(message.payload.eventType));
        },
      } as never,
    );

    await publisherB.processBatch();

    const completedEvents = await orm.em.fork().find(OutboxMessageEntity, {
      aggregateId: wallet.id,
    });
    expect(publishedByB).toEqual([
      'WagerTransactionProcessed',
      'WalletBalanceChanged',
    ]);
    expect(completedEvents.every((event) => event.publishedAt !== null)).toBe(true);
  });

  it('publishes LOSS, rejection, and pending-reference events according to the rules', async () => {
    const wallet = await createWallet('20.00');
    await processWager({ ...betInput(wallet.id, 'loss-1', '10.00'), kind: WagerTransactionKind.Loss });
    await processWager({ ...betInput(wallet.id, 'bet-rejected', '100.00') });
    await processWager({
      ...betInput(wallet.id, 'refund-pending', '10.00'),
      kind: WagerTransactionKind.Refund,
      referenceExternalTransactionId: 'missing-bet',
    });

    const events = await orm.em.fork().find(OutboxMessageEntity, { aggregateId: wallet.id });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      'WagerTransactionPendingReference',
      'WagerTransactionProcessed',
      'WagerTransactionRejected',
    ]);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity, { walletId: wallet.id })).toBe(0);
  });

  it('lets two publishers claim separate rows with PostgreSQL SKIP LOCKED', async () => {
    const em = orm.em.fork();
    for (let index = 0; index < 10; index += 1) {
      const message = em.create(OutboxMessageEntity, {
        id: crypto.randomUUID(),
        aggregateId: crypto.randomUUID(),
        eventType: 'TestEvent',
        payload: { index },
        occurredAt: new Date(Date.now() + index),
        attempts: 0,
        nextAttemptAt: null,
        publishedAt: null,
      });
      em.persist(message);
    }
    await em.flush();

    const claimedByA: string[] = [];
    const claimedByB: string[] = [];
    const workerA = thisWorker(claimedByA);
    const workerB = thisWorker(claimedByB);

    await Promise.all([workerA.processBatch(), workerB.processBatch()]);

    expect(claimedByA.length + claimedByB.length).toBe(10);
    expect(new Set([...claimedByA, ...claimedByB]).size).toBe(10);
    expect(await orm.em.fork().count(OutboxMessageEntity, { publishedAt: { $ne: null } })).toBe(10);
  });

  function thisWorker(claimed: string[]): OutboxPublisherWorker {
    return new OutboxPublisherWorker(
      orm.em.fork(),
      new MikroOrmOutboxPublisherRepository(),
      {
        publish: async (message: { id: string; }) => {
          claimed.push(message.id);
          await new Promise((resolve) => setTimeout(resolve, 20));
        },
      } as never,
    );
  }

  async function processWager(input: ProcessWagerTransactionInput, outboxRepository: OutboxRepository = new MikroOrmOutboxRepository()) {
    const em = orm.em.fork();
    return new ProcessWagerTransactionUseCase(
      new MikroOrmWalletRepository(),
      new MikroOrmWagerTransactionRepository(em),
      new MikroOrmWalletLedgerRepository(),
      outboxRepository,
      em,
    ).execute(input);
  }

  async function createWallet(balance: string): Promise<WalletEntity> {
    const em = orm.em.fork();
    const wallet = em.create(WalletEntity, {
      id: crypto.randomUUID(),
      playerId: crypto.randomUUID(),
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

  function betInput(walletId: string, externalTransactionId: string, amount: string): ProcessWagerTransactionInput {
    return {
      providerId: 'provider-a',
      externalTransactionId,
      idempotencyKey: `provider-a:${externalTransactionId}`,
      payloadHash: `hash-${externalTransactionId}`,
      playerId: crypto.randomUUID(),
      walletId,
      roundId: 'round-1',
      gameId: 'game-1',
      kind: WagerTransactionKind.Bet,
      money: { amount, currency },
    };
  }
});

class FailingMarkPublishedRepository implements OutboxPublisherRepository {
  constructor(private readonly delegate: OutboxPublisherRepository) {}

  findPending(...args: Parameters<OutboxPublisherRepository['findPending']>) {
    return this.delegate.findPending(...args);
  }

  async markPublished(): Promise<void> {
    throw new Error('SIMULATED_PUBLISHER_CRASH');
  }

  markRetry(...args: Parameters<OutboxPublisherRepository['markRetry']>) {
    return this.delegate.markRetry(...args);
  }
}

class CrashAfterPublishRepository implements OutboxPublisherRepository {
  constructor(private readonly delegate: OutboxPublisherRepository) {}

  findPending(...args: Parameters<OutboxPublisherRepository['findPending']>) {
    return this.delegate.findPending(...args);
  }

  async markPublished(): Promise<void> {
    throw new Error('SIMULATED_PUBLISHER_DEATH');
  }

  async markRetry(): Promise<void> {
    throw new Error('SIMULATED_PUBLISHER_DEATH');
  }
}

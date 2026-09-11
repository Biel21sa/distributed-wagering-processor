import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import {
  ProcessWagerTransactionInput,
  ProcessWagerTransactionUseCase,
} from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { PendingReferenceWorker } from '../../src/modules/wagering/application/pending-reference.worker.js';
import { FailureCode } from '../../src/modules/wagering/domain/failure-code.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../src/modules/wagering/domain/wager-transaction-status.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { MikroOrmOutboxRepository } from '../../src/modules/outbox/infrastructure/persistence/mikro-orm-outbox.repository.js';
import { OutboxMessageEntity } from '../../src/modules/outbox/infrastructure/persistence/outbox-message.entity.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import {
  LedgerDirectionEntity,
  WalletLedgerEntryEntity,
} from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';

describe('out-of-order reference resolution', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [
        WalletEntity,
        WalletLedgerEntryEntity,
        WagerTransactionEntity,
        OutboxMessageEntity,
      ],
    });
    await orm.migrator.up();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(WalletLedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(OutboxMessageEntity, {});
    await em.nativeDelete(WalletEntity, {});
  });

  afterAll(async () => {
    await orm.close(true);
  });

  // --- item 33: REFUND arriving before its BET -------------------------------
  it('parks a REFUND as PENDING_REFERENCE and resolves it once the BET exists', async () => {
    const wallet = await createWallet('100.00');

    // BET has not been processed yet.
    const refund = await processWager({
      ...baseInput(wallet, 'refund-early', '25.00'),
      kind: WagerTransactionKind.Refund,
      referenceExternalTransactionId: 'bet-123',
    });
    expect(refund.status).toBe(WagerTransactionStatus.PendingReference);

    // Now the BET arrives and is processed (100 -> 75).
    const bet = await processWager(baseInput(wallet, 'bet-123', '25.00'));
    expect(bet.status).toBe(WagerTransactionStatus.Processed);
    expect(bet.balance).toEqual({ amount: '75.00', currency });

    // Worker picks up the parked refund and resolves it (75 + 25 -> 100).
    await runWorkerUntilResolved(refund.transactionId);

    const resolved = await orm.em
      .fork()
      .findOneOrFail(WagerTransactionEntity, { id: refund.transactionId });
    expect(resolved.status).toBe(WagerTransactionStatus.Processed);
    expect(resolved.referenceTransactionId).toBe(bet.transactionId);

    expect((await findWallet(wallet.id)).balance).toBe('100.00');

    const ledger = await orm.em
      .fork()
      .find(WalletLedgerEntryEntity, { transactionId: refund.transactionId });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ direction: 'CREDIT', amount: '25.00' });
  });

  // --- item 34: ROLLBACK arriving before its BET -----------------------------
  it('parks a ROLLBACK as PENDING_REFERENCE and reverses it once the BET exists', async () => {
    const wallet = await createWallet('100.00');

    const rollback = await processWager({
      ...baseInput(wallet, 'rollback-early', '25.00'),
      kind: WagerTransactionKind.Rollback,
      referenceExternalTransactionId: 'bet-123',
    });
    expect(rollback.status).toBe(WagerTransactionStatus.PendingReference);

    const bet = await processWager(baseInput(wallet, 'bet-123', '25.00'));
    expect(bet.balance).toEqual({ amount: '75.00', currency });

    await runWorkerUntilResolved(rollback.transactionId);

    const resolved = await orm.em
      .fork()
      .findOneOrFail(WagerTransactionEntity, { id: rollback.transactionId });
    expect(resolved.status).toBe(WagerTransactionStatus.Processed);

    // Rolling back a BET credits the funds back (75 + 25 -> 100).
    expect((await findWallet(wallet.id)).balance).toBe('100.00');

    const ledger = await orm.em
      .fork()
      .find(WalletLedgerEntryEntity, { transactionId: rollback.transactionId });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ direction: 'CREDIT', amount: '25.00' });
  });

  // --- item 35: duplicate REFUND ---------------------------------------------
  it('allows only one of two concurrent REFUNDs for the same BET', async () => {
    const wallet = await createWallet('100.00');
    const bet = await processWager(baseInput(wallet, 'bet-123', '25.00'));
    expect(bet.balance).toEqual({ amount: '75.00', currency });

    const refundA: ProcessWagerTransactionInput = {
      ...baseInput(wallet, 'refund-a', '25.00'),
      kind: WagerTransactionKind.Refund,
      referenceExternalTransactionId: 'bet-123',
    };
    const refundB: ProcessWagerTransactionInput = {
      ...baseInput(wallet, 'refund-b', '25.00'),
      kind: WagerTransactionKind.Refund,
      referenceExternalTransactionId: 'bet-123',
    };

    const results = await Promise.all([
      processWager(refundA),
      processWager(refundB),
    ]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual(
      [
        WagerTransactionStatus.Processed,
        WagerTransactionStatus.Rejected,
      ].sort(),
    );

    const rejected = results.find(
      (result) => result.status === WagerTransactionStatus.Rejected,
    );
    expect(rejected?.failureCode).toBe(FailureCode.DuplicateReversal);

    // Exactly one reversal applied: 75 + 25 -> 100, one CREDIT ledger row.
    expect((await findWallet(wallet.id)).balance).toBe('100.00');
    const credits = await orm.em
      .fork()
      .find(WalletLedgerEntryEntity, {
        walletId: wallet.id,
        direction: LedgerDirectionEntity.Credit,
      });
    expect(credits).toHaveLength(1);
  });

  // --- item 36: ROLLBACK of a WIN --------------------------------------------
  it('rolls back a WIN by debiting the credited amount', async () => {
    const wallet = await createWallet('100.00');

    const win = await processWager({
      ...baseInput(wallet, 'win-1', '50.00'),
      kind: WagerTransactionKind.Win,
    });
    expect(win.status).toBe(WagerTransactionStatus.Processed);
    expect(win.balance).toEqual({ amount: '150.00', currency });

    const rollback = await processWager({
      ...baseInput(wallet, 'rollback-win', '50.00'),
      kind: WagerTransactionKind.Rollback,
      referenceExternalTransactionId: 'win-1',
    });
    expect(rollback.status).toBe(WagerTransactionStatus.Processed);
    expect(rollback.balance).toEqual({ amount: '100.00', currency });

    const ledger = await orm.em
      .fork()
      .find(
        WalletLedgerEntryEntity,
        { walletId: wallet.id },
        { orderBy: { createdAt: 'asc', id: 'asc' } },
      );
    const directions = ledger.map((entry) => entry.direction);
    expect(directions).toContain('CREDIT');
    expect(directions).toContain('DEBIT');

    const winLedger = ledger.find(
      (entry) => entry.transactionId === win.transactionId,
    );
    const rollbackLedger = ledger.find(
      (entry) => entry.transactionId === rollback.transactionId,
    );
    expect(winLedger).toMatchObject({ direction: 'CREDIT', amount: '50.00' });
    expect(rollbackLedger).toMatchObject({ direction: 'DEBIT', amount: '50.00' });
  });

  // --- item 37: ROLLBACK of a WIN that would go negative ---------------------
  it('rejects a WIN rollback that would drive the balance negative with NEGATIVE_BALANCE_REVERSAL', async () => {
    const wallet = await createWallet('10.00');

    const win = await processWager({
      ...baseInput(wallet, 'win-big', '100.00'),
      kind: WagerTransactionKind.Win,
    });
    expect(win.balance).toEqual({ amount: '110.00', currency });

    // Simulate the wallet being drawn down elsewhere before the rollback, so
    // reversing the +100 WIN would require debiting more than is available.
    await setWalletBalance(wallet.id, '10.00');

    const rollback = await processWager({
      ...baseInput(wallet, 'rollback-win-big', '100.00'),
      kind: WagerTransactionKind.Rollback,
      referenceExternalTransactionId: 'win-big',
    });

    expect(rollback.status).toBe(WagerTransactionStatus.Rejected);
    expect(rollback.failureCode).toBe(FailureCode.NegativeBalanceReversal);
    expect(rollback.failureCode).not.toBe(FailureCode.InsufficientFunds);

    // Balance untouched by the rejected reversal.
    expect((await findWallet(wallet.id)).balance).toBe('10.00');
    const rollbackLedger = await orm.em
      .fork()
      .find(WalletLedgerEntryEntity, { transactionId: rollback.transactionId });
    expect(rollbackLedger).toHaveLength(0);
  });

  // --- helpers ---------------------------------------------------------------

  async function runWorkerUntilResolved(transactionId: string): Promise<void> {
    const worker = new PendingReferenceWorker(
      orm.em.fork(),
      new MikroOrmWagerTransactionRepository(orm.em.fork()),
      buildUseCase(),
    );

    for (let attempt = 0; attempt < 15; attempt += 1) {
      // Each failed lookup schedules the next retry with an exponential
      // backoff (seconds to minutes out). Rather than wait real time, clear
      // the scheduled time so the worker treats the row as due on the next
      // pass, exercising the real worker.processPending() path.
      await makeReferenceRetryDue(transactionId);

      await worker.processPending();

      const current = await orm.em
        .fork()
        .findOne(WagerTransactionEntity, { id: transactionId });
      if (
        current &&
        current.status !== WagerTransactionStatus.PendingReference
      ) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Transaction ${transactionId} never left PENDING_REFERENCE`);
  }

  async function makeReferenceRetryDue(transactionId: string): Promise<void> {
    const em = orm.em.fork();
    const transaction = await em.findOne(WagerTransactionEntity, {
      id: transactionId,
    });
    if (
      transaction &&
      transaction.status === WagerTransactionStatus.PendingReference
    ) {
      transaction.referenceNextAttemptAt = null;
      await em.flush();
    }
  }

  function buildUseCase(): ProcessWagerTransactionUseCase {
    const em = orm.em.fork();
    return new ProcessWagerTransactionUseCase(
      new MikroOrmWalletRepository(),
      new MikroOrmWagerTransactionRepository(em),
      new MikroOrmWalletLedgerRepository(),
      new MikroOrmOutboxRepository(),
      em,
    );
  }

  async function processWager(input: ProcessWagerTransactionInput) {
    return buildUseCase().execute(input);
  }

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

  async function setWalletBalance(id: string, balance: string): Promise<void> {
    const em = orm.em.fork();
    const wallet = await em.findOneOrFail(WalletEntity, { id });
    wallet.balance = balance;
    await em.flush();
  }

  async function findWallet(id: string): Promise<WalletEntity> {
    return orm.em.fork().findOneOrFail(WalletEntity, { id });
  }

  function baseInput(
    wallet: WalletEntity,
    externalTransactionId: string,
    amount: string,
  ): ProcessWagerTransactionInput {
    // A reversal (refund/rollback) is only valid when it shares provider,
    // player, wallet, round, and amount with the referenced transaction, so
    // every input for a given wallet must use that wallet's playerId and a
    // stable round.
    return {
      providerId: 'provider-a',
      externalTransactionId,
      idempotencyKey: `provider-a:${externalTransactionId}`,
      payloadHash: `hash-${externalTransactionId}`,
      playerId: wallet.playerId,
      walletId: wallet.id,
      roundId: 'round-1',
      gameId: 'game-1',
      kind: WagerTransactionKind.Bet,
      money: { amount, currency },
    };
  }
});

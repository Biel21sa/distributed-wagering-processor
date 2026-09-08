import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import { ProcessWagerTransactionUseCase, ProcessWagerTransactionInput } from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { WalletLedgerRepository } from '../../src/modules/wagering/application/ports/wallet-ledger-repository.port.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../src/modules/wagering/domain/wager-transaction-status.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { WalletLedgerEntry } from '../../src/modules/wallet/domain/wallet-ledger-entry.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';

class FailingLedgerRepository implements WalletLedgerRepository {
  async save(
    _em: Parameters<WalletLedgerRepository['save']>[0],
    _entry: WalletLedgerEntry,
  ): Promise<void> {
    throw new Error('SIMULATED_FAILURE');
  }
}

describe('wallet wagering integration', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [
        WalletEntity,
        WalletLedgerEntryEntity,
        WagerTransactionEntity,
      ],
    });
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

  it('processes a normal BET and records one debit ledger entry', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager(betInput(wallet.id, '25.00'));

    expect(result.status).toBe(WagerTransactionStatus.Processed);
    expect(result.balance).toEqual({
      amount: '75.00',
      currency,
    });

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('75.00');
    expect(storedWallet.version).toBe(2);

    const entries = await orm.em.fork().find(WalletLedgerEntryEntity, {
      walletId: wallet.id,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      direction: 'DEBIT',
      amount: '25.00',
      balanceBefore: '100.00',
      balanceAfter: '75.00',
    });
  });

  it('allows only one of two simultaneous BET 80 operations', async () => {
    const wallet = await createWallet('100.00');
    const inputA = betInput(wallet.id, '80.00');
    const inputB = betInput(wallet.id, '80.00');

    const results = await Promise.all([
      processWager(inputA),
      processWager(inputB),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      WagerTransactionStatus.Processed,
      WagerTransactionStatus.Rejected,
    ].sort());

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('20.00');
    expect(storedWallet.version).toBe(2);

    const entries = await orm.em.fork().find(WalletLedgerEntryEntity, {
      walletId: wallet.id,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      direction: 'DEBIT',
      amount: '80.00',
      balanceBefore: '100.00',
      balanceAfter: '20.00',
    });
  });

  it('rolls back wallet and transaction changes when ledger persistence fails', async () => {
    const wallet = await createWallet('100.00');
    const useCase = createUseCase(orm.em.fork(), new FailingLedgerRepository());

    await expect(
      useCase.execute(betInput(wallet.id, '25.00')),
    ).rejects.toThrow('SIMULATED_FAILURE');

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('100.00');
    expect(storedWallet.version).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(0);
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(0);
  });

  it('processes LOSS without changing the wallet or creating a ledger entry', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager({
      ...betInput(wallet.id, '50.00'),
      kind: WagerTransactionKind.Loss,
    });

    expect(result.status).toBe(WagerTransactionStatus.Processed);

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('100.00');
    expect(storedWallet.version).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(0);
  });

  it('processes WIN with a credit and increments the wallet version', async () => {
    const wallet = await createWallet('100.00');
    const result = await processWager({
      ...betInput(wallet.id, '50.00'),
      kind: WagerTransactionKind.Win,
    });

    expect(result.status).toBe(WagerTransactionStatus.Processed);
    expect(result.balance).toEqual({
      amount: '150.00',
      currency,
    });

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('150.00');
    expect(storedWallet.version).toBe(2);

    const entries = await orm.em.fork().find(WalletLedgerEntryEntity, {
      walletId: wallet.id,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      direction: 'CREDIT',
      amount: '50.00',
      balanceBefore: '100.00',
      balanceAfter: '150.00',
    });
  });

  it('increments version for consecutive BET and WIN operations', async () => {
    const wallet = await createWallet('100.00');

    await processWager(betInput(wallet.id, '25.00'));
    await processWager({
      ...betInput(wallet.id, '50.00'),
      kind: WagerTransactionKind.Win,
    });

    const storedWallet = await findWallet(wallet.id);
    expect(storedWallet.balance).toBe('125.00');
    expect(storedWallet.version).toBe(3);
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
    const wallet = await orm.em.fork().findOne(WalletEntity, { id });
    if (!wallet) {
      throw new Error(`Wallet ${id} not found`);
    }

    return wallet;
  }

  function createUseCase(
    em: ReturnType<typeof orm.em.fork>,
    ledgerRepository: WalletLedgerRepository = new MikroOrmWalletLedgerRepository(),
  ): ProcessWagerTransactionUseCase {
    return new ProcessWagerTransactionUseCase(
      new MikroOrmWalletRepository(),
      new MikroOrmWagerTransactionRepository(em),
      ledgerRepository,
      em,
    );
  }

  async function processWager(
    input: ProcessWagerTransactionInput,
  ) {
    const em = orm.em.fork();
    return createUseCase(em).execute(input);
  }

  function betInput(
    walletId: string,
    amount: string,
  ): ProcessWagerTransactionInput {
    const id = randomUUID();
    return {
      providerId: 'test-provider',
      externalTransactionId: id,
      idempotencyKey: `key-${id}`,
      payloadHash: `hash-${id}`,
      playerId: randomUUID(),
      walletId,
      roundId: 'round-1',
      gameId: 'game-1',
      kind: WagerTransactionKind.Bet,
      money: {
        amount,
        currency,
      },
    };
  }
});

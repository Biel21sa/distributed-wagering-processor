import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import { ProcessInboxMessageUseCase } from '../../src/modules/inbox/application/process-inbox-message.use-case.js';
import { MikroOrmInboxRepository } from '../../src/modules/inbox/infrastructure/persistence/mikro-orm-inbox.repository.js';
import { InboxMessageEntity } from '../../src/modules/inbox/infrastructure/persistence/inbox-message.entity.js';
import { WagerTransactionRequestedMessage } from '../../src/modules/messaging/domain/wager-transaction-requested.event.js';
import { ProcessWagerTransactionUseCase } from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../src/modules/wagering/domain/wager-transaction-status.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';

describe('Inbox message processing', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [
        WalletEntity,
        WalletLedgerEntryEntity,
        WagerTransactionEntity,
        InboxMessageEntity,
      ],
    });
    await orm.migrator.up();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(InboxMessageEntity, {});
    await em.nativeDelete(WalletLedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('processes one message, creates one transaction and ledger, and marks Inbox processed', async () => {
    const wallet = await createWallet('100.00');
    const message = createMessage(wallet, 'message-normal', '25.00');

    const result = await processMessage(message);

    expect(result.status).toBe(WagerTransactionStatus.Processed);
    expect(await orm.em.fork().count(InboxMessageEntity, { messageId: message.messageId })).toBe(1);
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect((await findInbox(message.messageId)).processedAt).not.toBeNull();
  });

  it('does not debit again when the same message is redelivered after commit', async () => {
    const wallet = await createWallet('100.00');
    const message = createMessage(wallet, 'message-redelivery', '25.00');

    await processMessage(message);
    const replay = await processMessage(message);

    expect(replay).toBeUndefined();
    expect(await orm.em.fork().count(InboxMessageEntity, { messageId: message.messageId })).toBe(1);
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
  });

  it('keeps one Inbox row and one financial effect for a duplicated messageId', async () => {
    const wallet = await createWallet('100.00');
    const message = createMessage(wallet, 'message-duplicate', '25.00');

    await Promise.all([processMessage(message), processMessage(message)]);

    expect(await orm.em.fork().count(InboxMessageEntity, { messageId: message.messageId })).toBe(1);
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(1);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
  });

  it('processes messages for different wallets in parallel', async () => {
    const walletA = await createWallet('100.00');
    const walletB = await createWallet('100.00');

    await Promise.all([
      processMessage(createMessage(walletA, 'message-wallet-a', '25.00')),
      processMessage(createMessage(walletB, 'message-wallet-b', '25.00')),
    ]);

    expect((await findWallet(walletA.id)).balance).toBe('75.00');
    expect((await findWallet(walletB.id)).balance).toBe('75.00');
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(2);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(2);
  });

  it('marks insufficient funds as REJECTED and commits the Inbox so it is ACKable', async () => {
    const wallet = await createWallet('50.00');
    const message = createMessage(wallet, 'message-business-failure', '100.00');

    const result = await processMessage(message);

    expect(result.status).toBe(WagerTransactionStatus.Rejected);
    expect(result.failureCode).toBe('INSUFFICIENT_FUNDS');
    expect((await findWallet(wallet.id)).balance).toBe('50.00');
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(0);
    expect((await findInbox(message.messageId)).processedAt).not.toBeNull();
  });

  it('rolls back Inbox persistence on a transient database failure', async () => {
    const wallet = await createWallet('100.00');
    const message = createMessage(wallet, 'message-transient-failure', '25.00');
    const transientProcessor = {
      execute: async () => {
        throw new Error('database timeout');
      },
    } as unknown as ProcessWagerTransactionUseCase;
    const useCase = new ProcessInboxMessageUseCase(
      new MikroOrmInboxRepository(),
      transientProcessor,
      orm.em.fork(),
    );

    await expect(useCase.execute(message)).rejects.toThrow('database timeout');
    expect(await orm.em.fork().count(InboxMessageEntity)).toBe(0);
  });

  async function processMessage(message: WagerTransactionRequestedMessage) {
    const em = orm.em.fork();
    return new ProcessInboxMessageUseCase(
      new MikroOrmInboxRepository(),
      new ProcessWagerTransactionUseCase(
        new MikroOrmWalletRepository(),
        new MikroOrmWagerTransactionRepository(em),
        new MikroOrmWalletLedgerRepository(),
        em,
      ),
      em,
    ).execute(message);
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

  async function findWallet(id: string): Promise<WalletEntity> {
    return orm.em.fork().findOneOrFail(WalletEntity, { id });
  }

  async function findInbox(messageId: string): Promise<InboxMessageEntity> {
    return orm.em.fork().findOneOrFail(InboxMessageEntity, { messageId });
  }

  function createMessage(
    wallet: WalletEntity,
    messageId: string,
    amount: string,
  ): WagerTransactionRequestedMessage {
    return {
      messageId,
      type: 'WagerTransactionRequested',
      occurredAt: new Date().toISOString(),
      data: {
        providerId: 'provider-a',
        externalTransactionId: `external-${messageId}`,
        idempotencyKey: `provider-a:${messageId}`,
        playerId: wallet.playerId,
        walletId: wallet.id,
        roundId: 'round-1',
        gameId: 'game-1',
        kind: WagerTransactionKind.Bet,
        money: { amount, currency },
      },
    };
  }
});

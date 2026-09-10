import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mikroOrmConfig from '../../mikro-orm.config.js';
import { ProcessInboxMessageUseCase } from '../../src/modules/inbox/application/process-inbox-message.use-case.js';
import { MikroOrmInboxRepository } from '../../src/modules/inbox/infrastructure/persistence/mikro-orm-inbox.repository.js';
import { InboxMessageEntity } from '../../src/modules/inbox/infrastructure/persistence/inbox-message.entity.js';
import { MikroOrmOutboxRepository } from '../../src/modules/outbox/infrastructure/persistence/mikro-orm-outbox.repository.js';
import { OutboxMessageEntity } from '../../src/modules/outbox/infrastructure/persistence/outbox-message.entity.js';
import { SqsWagerConsumer } from '../../src/modules/messaging/infrastructure/sqs-wager-consumer.js';
import { WagerTransactionKind } from '../../src/modules/wagering/domain/wager-transaction-kind.js';
import { ProcessWagerTransactionUseCase } from '../../src/modules/wagering/application/process-wager-transaction.use-case.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { MikroOrmWagerTransactionRepository } from '../../src/modules/wagering/infrastructure/persistence/mikro-orm-wager-transaction.repository.js';
import { MikroOrmWalletLedgerRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet-ledger.repository.js';
import { MikroOrmWalletRepository } from '../../src/modules/wallet/infrastructure/persistence/mikro-orm-wallet.repository.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const currency = 'BRL';

describe('SQS wager consumer', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      ...mikroOrmConfig,
      entities: [
        WalletEntity,
        WalletLedgerEntryEntity,
        WagerTransactionEntity,
        InboxMessageEntity,
        OutboxMessageEntity,
      ],
    });
    await orm.migrator.up();
  });

  beforeEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete(InboxMessageEntity, {});
    await em.nativeDelete(OutboxMessageEntity, {});
    await em.nativeDelete(WalletLedgerEntryEntity, {});
    await em.nativeDelete(WagerTransactionEntity, {});
    await em.nativeDelete(WalletEntity, {});
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it('processes one SQS message, commits, and ACKs only after the financial effect exists', async () => {
    const wallet = await createWallet('100.00');
    const message = createSqsMessage(wallet.id, wallet.playerId, 'sqs-message-001');
    const ackSnapshots: Array<{ wallet: string; transactions: number; ledger: number; inbox: number }> = [];
    const client = {
      send: async (command: unknown) => {
        if (command instanceof DeleteMessageCommand) {
          ackSnapshots.push({
            wallet: (await findWallet(wallet.id)).balance,
            transactions: await orm.em.fork().count(WagerTransactionEntity),
            ledger: await orm.em.fork().count(WalletLedgerEntryEntity),
            inbox: await orm.em.fork().count(InboxMessageEntity),
          });
        }
        return {};
      },
    } as unknown as SQSClient;

    const consumer = createConsumer(client);
    await consumer.processMessage(message);

    expect(ackSnapshots).toEqual([
      { wallet: '75.00', transactions: 1, ledger: 1, inbox: 1 },
    ]);
  });

  it('ACKs the redelivered same message without creating another financial effect', async () => {
    const wallet = await createWallet('100.00');
    const message = createSqsMessage(wallet.id, wallet.playerId, 'sqs-message-002');
    let ackCount = 0;
    const client = {
      send: async (command: unknown) => {
        if (command instanceof DeleteMessageCommand) {
          ackCount += 1;
        }
        return {};
      },
    } as unknown as SQSClient;

    const consumer = createConsumer(client);
    await consumer.processMessage(message);
    await consumer.processMessage({
      ...message,
      ReceiptHandle: 'redelivery-receipt',
    });

    expect(ackCount).toBe(2);
    expect((await findWallet(wallet.id)).balance).toBe('75.00');
    expect(await orm.em.fork().count(WagerTransactionEntity)).toBe(1);
    expect(await orm.em.fork().count(WalletLedgerEntryEntity)).toBe(1);
    expect(await orm.em.fork().count(InboxMessageEntity)).toBe(1);
  });

  function createConsumer(client: SQSClient): SqsWagerConsumer {
    const em = orm.em.fork();
    const processWager = new ProcessWagerTransactionUseCase(
      new MikroOrmWalletRepository(),
      new MikroOrmWagerTransactionRepository(em),
      new MikroOrmWalletLedgerRepository(),
      new MikroOrmOutboxRepository(),
      em,
    );
    const processor = new ProcessInboxMessageUseCase(
      new MikroOrmInboxRepository(),
      processWager,
      em,
    );
    return new SqsWagerConsumer(processor, client);
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

  function createSqsMessage(
    walletId: string,
    playerId: string,
    messageId: string,
  ) {
    return {
      MessageId: messageId,
      ReceiptHandle: `receipt-${messageId}`,
      Body: JSON.stringify({
        messageId,
        type: 'WagerTransactionRequested',
        occurredAt: new Date().toISOString(),
        data: {
          providerId: 'provider-a',
          externalTransactionId: `external-${messageId}`,
          idempotencyKey: `provider-a:${messageId}`,
          playerId,
          walletId,
          roundId: 'round-1',
          gameId: 'fortune-chimp',
          kind: WagerTransactionKind.Bet,
          money: { amount: '25.00', currency },
        },
      }),
    };
  }
});

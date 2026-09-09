import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { MikroORM } from '@mikro-orm/postgresql';
import mikroOrmConfig from '../mikro-orm.config.js';
import { WagerTransactionEntity } from '../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';
import { WalletLedgerEntryEntity } from '../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WalletEntity } from '../src/modules/wallet/infrastructure/persistence/wallet.entity.js';

const balance = process.argv[2] ?? '100.00';
const currency = process.argv[3] ?? 'BRL';
const playerId = process.argv[4] ?? randomUUID();
const walletId = randomUUID();

const orm = await MikroORM.init({
  ...mikroOrmConfig,
  entities: [WalletEntity, WalletLedgerEntryEntity, WagerTransactionEntity],
});

try {
  await orm.migrator.up();

  const em = orm.em.fork();
  const now = new Date();
  const wallet = em.create(WalletEntity, {
    id: walletId,
    playerId,
    currency,
    balance,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  em.persist(wallet);
  await em.flush();

  const message = {
    messageId: 'msg-001',
    type: 'WagerTransactionRequested',
    occurredAt: now.toISOString(),
    data: {
      providerId: 'provider-a',
      externalTransactionId: 'sqs-bet-001',
      idempotencyKey: 'provider-a:sqs-bet-001',
      playerId,
      walletId,
      roundId: 'round-1',
      gameId: 'fortune-chimp',
      kind: 'BET',
      money: {
        amount: '25.00',
        currency,
      },
    },
  };

  console.log(`PLAYER_ID=${playerId}`);
  console.log(`WALLET_ID=${walletId}`);
  console.log(`BALANCE=${balance}`);
  console.log('SQS_MESSAGE_BODY=');
  console.log(JSON.stringify(message, null, 2));
} finally {
  await orm.close(true);
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { GlobalExceptionFilter } from '../../src/shared/infrastructure/http/global-exception.filter.js';
import { WalletEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet.entity.js';
import { WalletLedgerEntryEntity } from '../../src/modules/wallet/infrastructure/persistence/wallet-ledger-entry.entity.js';
import { WagerTransactionEntity } from '../../src/modules/wagering/infrastructure/persistence/wager-transaction.entity.js';

const currency = 'BRL';

describe('Wallet API (integration)', () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mirror the production global setup from main.ts so validation and
    // error mapping behave exactly as they do at runtime.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();

    orm = app.get(MikroORM);
    await orm.migrator.up();
  });

  beforeEach(async () => {
    // TRUNCATE ... CASCADE clears all tables regardless of FK order, which is
    // more reliable than ordered nativeDelete calls across forked contexts.
    await orm.em.getConnection().execute(
      'TRUNCATE TABLE "wallet_ledger_entries", "wager_transactions", "outbox_messages", "inbox_messages", "wallets" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();

  describe('POST /wallets', () => {
    it('creates a wallet with an initial balance', async () => {
      const playerId = randomUUID();

      const response = await request(server())
        .post('/wallets')
        .send({
          playerId,
          initialBalance: { amount: '1000.00', currency },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        playerId,
        balance: { amount: '1000.00', currency },
        version: 1,
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('creates an OPENING transaction and a CREDIT ledger entry for a non-zero balance', async () => {
      const playerId = randomUUID();

      const response = await request(server())
        .post('/wallets')
        .send({
          playerId,
          initialBalance: { amount: '250.00', currency },
        })
        .expect(201);

      const walletId = response.body.id;

      const entries = await orm.em
        .fork()
        .find(WalletLedgerEntryEntity, { walletId });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        direction: 'CREDIT',
        amount: '250.00',
        balanceBefore: '0.00',
        balanceAfter: '250.00',
      });

      const transactions = await orm.em
        .fork()
        .find(WagerTransactionEntity, { walletId });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].kind).toBe('OPENING');
    });

    it('rejects a negative initial balance with 400', async () => {
      await request(server())
        .post('/wallets')
        .send({
          playerId: randomUUID(),
          initialBalance: { amount: '-10.00', currency },
        })
        .expect(400);
    });

    it('rejects a non-uuid playerId with 400', async () => {
      await request(server())
        .post('/wallets')
        .send({
          playerId: 'not-a-uuid',
          initialBalance: { amount: '10.00', currency },
        })
        .expect(400);
    });

    it('returns 409 when a wallet already exists for the player and currency', async () => {
      const playerId = randomUUID();
      const body = {
        playerId,
        initialBalance: { amount: '100.00', currency },
      };

      await request(server()).post('/wallets').send(body).expect(201);

      const conflict = await request(server())
        .post('/wallets')
        .send(body)
        .expect(409);

      expect(conflict.body).toMatchObject({
        statusCode: 409,
        code: 'WALLET_ALREADY_EXISTS',
      });
    });
  });

  describe('GET /wallets/:id', () => {
    it('returns the wallet when it exists', async () => {
      const playerId = randomUUID();
      const created = await request(server())
        .post('/wallets')
        .send({
          playerId,
          initialBalance: { amount: '500.00', currency },
        })
        .expect(201);

      const walletId = created.body.id;

      const response = await request(server())
        .get(`/wallets/${walletId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: walletId,
        playerId,
        balance: { amount: '500.00', currency },
        version: 1,
      });
    });

    it('returns an empty body for an unknown wallet', async () => {
      const response = await request(server())
        .get(`/wallets/${randomUUID()}`)
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('GET /wallets/:id/ledger', () => {
    it('lists ledger entries for a wallet', async () => {
      const created = await request(server())
        .post('/wallets')
        .send({
          playerId: randomUUID(),
          initialBalance: { amount: '750.00', currency },
        })
        .expect(201);

      const walletId = created.body.id;

      const response = await request(server())
        .get(`/wallets/${walletId}/ledger`)
        .query({ limit: 50 })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        direction: 'CREDIT',
        money: { amount: '750.00', currency },
        balanceBefore: { amount: '0.00', currency },
        balanceAfter: { amount: '750.00', currency },
      });
      expect(response.body.nextCursor).toBeNull();
    });

    it('uses the default limit when none is provided', async () => {
      const created = await request(server())
        .post('/wallets')
        .send({
          playerId: randomUUID(),
          initialBalance: { amount: '10.00', currency },
        })
        .expect(201);

      await request(server())
        .get(`/wallets/${created.body.id}/ledger`)
        .expect(200);
    });

    it('rejects an out-of-range limit with 400', async () => {
      const created = await request(server())
        .post('/wallets')
        .send({
          playerId: randomUUID(),
          initialBalance: { amount: '10.00', currency },
        })
        .expect(201);

      await request(server())
        .get(`/wallets/${created.body.id}/ledger`)
        .query({ limit: 1000 })
        .expect(400);
    });
  });

  describe('POST /wallets/:id/reconciliation', () => {
    it('reports a consistent wallet', async () => {
      const created = await request(server())
        .post('/wallets')
        .send({
          playerId: randomUUID(),
          initialBalance: { amount: '300.00', currency },
        })
        .expect(201);

      const walletId = created.body.id;

      const response = await request(server())
        .post(`/wallets/${walletId}/reconciliation`)
        .expect(201);

      expect(response.body).toMatchObject({
        walletId,
        storedBalance: { amount: '300.00', currency },
        calculatedBalance: { amount: '300.00', currency },
        difference: { amount: '0.00', currency },
        consistent: true,
        checkedEntries: 1,
      });
    });

    it('returns 404 for an unknown wallet', async () => {
      const response = await request(server())
        .post(`/wallets/${randomUUID()}/reconciliation`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});

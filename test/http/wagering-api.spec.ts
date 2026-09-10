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

const currency = 'BRL';

describe('Wagering API (integration)', () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mirror the production global setup from main.ts.
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
    // TRUNCATE ... CASCADE clears all tables regardless of FK order.
    await orm.em.getConnection().execute(
      'TRUNCATE TABLE "wallet_ledger_entries", "wager_transactions", "outbox_messages", "inbox_messages", "wallets" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();

  async function createWallet(balance: string): Promise<{
    walletId: string;
    playerId: string;
  }> {
    const playerId = randomUUID();
    const response = await request(server())
      .post('/wallets')
      .send({
        playerId,
        initialBalance: { amount: balance, currency },
      })
      .expect(201);

    return { walletId: response.body.id, playerId };
  }

  function betBody(overrides: Record<string, unknown> = {}) {
    const externalTransactionId = randomUUID();
    return {
      providerId: 'test-provider',
      externalTransactionId,
      playerId: randomUUID(),
      walletId: randomUUID(),
      roundId: 'round-1',
      gameId: 'game-1',
      kind: 'BET',
      money: { amount: '25.00', currency },
      ...overrides,
    };
  }

  describe('POST /wagering/transactions', () => {
    it('processes a BET and returns the updated balance', async () => {
      const { walletId, playerId } = await createWallet('100.00');
      const body = betBody({ walletId, playerId });

      const response = await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', randomUUID())
        .set('x-correlation-id', randomUUID())
        .send(body)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'PROCESSED',
        balance: { amount: '75.00', currency },
        idempotentReplay: false,
      });
      expect(response.body.transactionId).toEqual(expect.any(String));
    });

    it('rejects a BET beyond the balance with an INSUFFICIENT_FUNDS outcome', async () => {
      const { walletId, playerId } = await createWallet('10.00');
      const body = betBody({
        walletId,
        playerId,
        money: { amount: '50.00', currency },
      });

      const response = await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', randomUUID())
        .send(body)
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'REJECTED',
        failureCode: 'INSUFFICIENT_FUNDS',
      });
    });

    it('returns 400 when the Idempotency-Key header is missing', async () => {
      const { walletId, playerId } = await createWallet('100.00');

      await request(server())
        .post('/wagering/transactions')
        .send(betBody({ walletId, playerId }))
        .expect(400);
    });

    it('returns 400 for an invalid transaction kind', async () => {
      const { walletId, playerId } = await createWallet('100.00');

      await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', randomUUID())
        .send(betBody({ walletId, playerId, kind: 'NOT_A_KIND' }))
        .expect(400);
    });

    it('replays the same result for a repeated idempotency key', async () => {
      const { walletId, playerId } = await createWallet('100.00');
      const body = betBody({ walletId, playerId });
      const idempotencyKey = randomUUID();

      const first = await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', idempotencyKey)
        .send(body)
        .expect(201);

      const second = await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', idempotencyKey)
        .send(body)
        .expect(201);

      expect(second.body.transactionId).toBe(first.body.transactionId);
      expect(second.body.idempotentReplay).toBe(true);

      // Only one BET should have been applied to the wallet.
      const wallet = await orm.em
        .fork()
        .findOne(WalletEntity, { id: walletId });
      expect(wallet?.balance).toBe('75.00');
    });
  });

  describe('GET /wagering/transactions/:id', () => {
    it('returns a processed transaction by its id', async () => {
      const { walletId, playerId } = await createWallet('100.00');
      const created = await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', randomUUID())
        .send(betBody({ walletId, playerId }))
        .expect(201);

      const transactionId = created.body.transactionId;

      const response = await request(server())
        .get(`/wagering/transactions/${transactionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        transactionId,
        walletId,
        kind: 'BET',
        status: 'PROCESSED',
        money: { amount: '25.00', currency },
      });
    });

    it('returns 404 for an unknown transaction id', async () => {
      const response = await request(server())
        .get(`/wagering/transactions/${randomUUID()}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('GET /providers/:providerId/wagering/transactions/:externalTransactionId', () => {
    it('returns a transaction by provider and external id', async () => {
      const { walletId, playerId } = await createWallet('100.00');
      const body = betBody({ walletId, playerId });

      await request(server())
        .post('/wagering/transactions')
        .set('idempotency-key', randomUUID())
        .send(body)
        .expect(201);

      const response = await request(server())
        .get(
          `/providers/${body.providerId}/wagering/transactions/${body.externalTransactionId}`,
        )
        .expect(200);

      expect(response.body).toMatchObject({
        providerId: body.providerId,
        externalTransactionId: body.externalTransactionId,
        status: 'PROCESSED',
      });
    });

    it('returns 404 for an unknown provider transaction', async () => {
      const response = await request(server())
        .get(
          `/providers/unknown-provider/wagering/transactions/${randomUUID()}`,
        )
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});

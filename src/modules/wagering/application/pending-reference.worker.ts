import { EntityManager } from '@mikro-orm/postgresql';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ProcessWagerTransactionUseCase } from './process-wager-transaction.use-case.js';
import { WagerTransactionRepository } from './ports/wager-transaction-repository.port.js';

export class PendingReferenceWorker implements OnModuleInit, OnModuleDestroy {
  private running = false;

  constructor(
    private readonly em: EntityManager,
    private readonly repository: WagerTransactionRepository,
    private readonly processWager: ProcessWagerTransactionUseCase,
  ) {}

  onModuleInit(): void {
    if (process.env.PENDING_REFERENCE_WORKER_ENABLED === 'true') {
      void this.start();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async start(): Promise<void> {
    this.running = true;

    while (this.running) {
      await this.processPending();

      await this.sleep(1000);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async processPending(): Promise<void> {
    const transactions = await this.repository.findPendingReferences(
      this.em.fork(),
      new Date(),
      50,
    );

    for (const transaction of transactions) {
      await this.processWager.retryPendingReference(transaction.id);
    }
  }

  private sleep(
    milliseconds: number,
  ): Promise<void> {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}
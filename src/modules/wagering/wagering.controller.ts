import {
  Body,
  ConflictException,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { calculatePayloadHash, WagerPayloadForHash } from './application/payload-hash.js';
import {
  ProcessWagerTransactionInput,
  ProcessWagerTransactionUseCase,
} from './application/process-wager-transaction.use-case.js';
import { IdempotencyConflictError } from './domain/idempotency-conflict.error.js';
import { WagerTransactionKind } from './domain/wager-transaction-kind.js';

interface ProcessWagerRequest extends Omit<WagerPayloadForHash, 'kind'> {
  playerId: string;
  walletId: string;
  kind: WagerTransactionKind;
}

@Controller('wagers')
export class WageringController {
  constructor(
    private readonly processWagerTransaction: ProcessWagerTransactionUseCase,
  ) {}

  @Post()
  async process(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: ProcessWagerRequest,
  ) {
    if (!idempotencyKey) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const input: ProcessWagerTransactionInput = {
      ...body,
      idempotencyKey,
      payloadHash: calculatePayloadHash(body),
    };

    try {
      return await this.processWagerTransaction.execute(input);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }
  }
}

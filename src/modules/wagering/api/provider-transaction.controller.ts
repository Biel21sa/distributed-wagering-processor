import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { GetProviderTransactionUseCase } from '../application/get-provider-transaction.use-case.js';

@Controller(
  'providers/:providerId/wagering/transactions',
)
export class ProviderTransactionController {
  constructor(
    private readonly getTransaction:
      GetProviderTransactionUseCase,
  ) {}

  @Get(':externalTransactionId')
  async get(
    @Param('providerId')
    providerId: string,

    @Param(
      'externalTransactionId',
    )
    externalTransactionId: string,
  ) {
    return this.getTransaction.execute(
      providerId,
      externalTransactionId,
    );
  }
}
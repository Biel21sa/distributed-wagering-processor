import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    Post,
} from '@nestjs/common';
import { ProcessWagerTransactionUseCase } from '../application/process-wager-transaction.use-case.js';
import { CreateWagerTransactionDto } from './dto/create-wager-transaction.dto.js';
import { calculatePayloadHash } from '../application/payload-hash.js';
import { GetWagerTransactionUseCase } from '../application/get-wager-transaction.use-case.js';

@Controller('wagering/transactions')
export class WageringController {
    constructor(
        private readonly processWager:
            ProcessWagerTransactionUseCase,
        private readonly getTransaction:
            GetWagerTransactionUseCase,
    ) { }

    @Post()
    async create(
        @Headers(
            'idempotency-key',
        )
        idempotencyKey: string,

        @Headers(
            'x-correlation-id',
        )
        correlationId: string,

        @Body()
        body: CreateWagerTransactionDto,
    ) {
        if (!idempotencyKey) {
            throw new BadRequestException(
                'Idempotency-Key is required',
            );
        }

        const payload = {
            providerId:
                body.providerId,

            externalTransactionId:
                body.externalTransactionId,

            playerId:
                body.playerId,

            walletId:
                body.walletId,

            roundId:
                body.roundId,

            gameId:
                body.gameId,

            kind:
                body.kind,

            money:
                body.money,

            referenceExternalTransactionId:
                body.referenceExternalTransactionId,
        };

        const payloadHash =
            calculatePayloadHash(
                payload,
            );

        return this.processWager.execute({
            ...payload,

            idempotencyKey,

            payloadHash,

            correlationId,
        });
    }

    @Get(':transactionId')
    async get(
        @Param('transactionId')
        transactionId: string,
    ) {
        return this.getTransaction.execute(
            transactionId,
        );
    }
}
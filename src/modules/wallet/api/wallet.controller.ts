import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { CreateWalletUseCase } from '../application/create-wallet.use-case.js';
import { GetWalletUseCase } from '../application/get-wallet.use-case.js';
import { LedgerQueryDto } from './dto/ledger-query.dto.js';
import { GetWalletLedgerUseCase } from '../application/get-wallet-ledger.use-case.js';
import { ReconcileWalletUseCase } from '../application/reconcile-wallet.use-case.js';

@Controller('wallets')
export class WalletController {
    constructor(
        private readonly createWallet:
            CreateWalletUseCase,
        private readonly getWallet:
            GetWalletUseCase,
        private readonly getLedger:
            GetWalletLedgerUseCase,
        private readonly reconcileWallet:
            ReconcileWalletUseCase
    ) { }

    @Post()
    async create(
        @Body()
        body: CreateWalletDto,
    ) {
        return this.createWallet.execute({
            playerId:
                body.playerId,

            initialBalance: body.initialBalance,
        });
    }

    @Post(':walletId/reconciliation')
    async reconcile(
        @Param('walletId')
        walletId: string,
    ) {
        return this.reconcileWallet.execute(
            walletId,
        );
    }

    @Get(':walletId')
    async get(
        @Param('walletId')
        walletId: string,
    ) {
        return this.getWallet.execute(
            walletId,
        );
    }

    @Get(':walletId/ledger')
    async ledger(
        @Param('walletId')
        walletId: string,

        @Query()
        query: LedgerQueryDto,
    ) {
        return this.getLedger.execute(
            walletId,
            query,
        );
    }
}
import { calculatePayloadHash } from "../../wagering/application/payload-hash.js";
import { ProcessWagerTransactionUseCase } from "../../wagering/application/process-wager-transaction.use-case.js";
import { WagerTransactionRequestedMessage } from "../domain/wager-transaction-requested.event.js";


export class ProcessWagerMessageUseCase {
    constructor(
        private readonly processWager:
            ProcessWagerTransactionUseCase,
    ) { }

    async execute(
        message:
            WagerTransactionRequestedMessage,
    ) {
        const payloadHash =
            calculatePayloadHash(
                message.data,
            );
        return this.processWager.execute({
            providerId:
                message.data.providerId,

            externalTransactionId:
                message.data.externalTransactionId,

            idempotencyKey:
                message.data.idempotencyKey,

            payloadHash,

            playerId:
                message.data.playerId,

            walletId:
                message.data.walletId,

            roundId:
                message.data.roundId,

            gameId:
                message.data.gameId,

            kind:
                message.data.kind,

            money:
                message.data.money,

            referenceExternalTransactionId:
                message.data
                    .referenceExternalTransactionId,
        });
    }
}
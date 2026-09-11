export function makePlayerId(): string {
  return crypto.randomUUID();
}

export function makeWalletId(): string {
  return crypto.randomUUID();
}

export function makeWagerPayload(
  overrides: Partial<{
    providerId: string;
    externalTransactionId: string;
    playerId: string;
    walletId: string;
    roundId: string;
    gameId: string;
    kind: string;
    amount: string;
    currency: string;
  }> = {},
) {
  return {
    providerId:
      overrides.providerId ??
      'provider-a',

    externalTransactionId:
      overrides.externalTransactionId ??
      `transaction-${crypto.randomUUID()}`,

    playerId:
      overrides.playerId ??
      makePlayerId(),

    walletId:
      overrides.walletId ??
      makeWalletId(),

    roundId:
      overrides.roundId ??
      'round-1',

    gameId:
      overrides.gameId ??
      'fortune-chimp',

    kind:
      overrides.kind ??
      'BET',

    money: {
      amount:
        overrides.amount ??
        '25.00',

      currency:
        overrides.currency ??
        'BRL',
    },
  };
}
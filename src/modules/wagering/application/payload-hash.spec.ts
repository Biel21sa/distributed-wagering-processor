import { calculatePayloadHash } from "./payload-hash.js";


describe(
  'Payload hash',
  () => {
    test(
      'same payload with different property order should generate same hash',
      () => {
        const first = {
          providerId: 'provider-a',
          externalTransactionId: 'bet-1',
          playerId: 'player-1',
          walletId: 'wallet-1',
          roundId: 'round-1',
          gameId: 'game-1',
          kind: 'BET',

          money: {
            amount: '25.00',
            currency: 'BRL',
          },
        };

        const second = {
          walletId: 'wallet-1',
          providerId: 'provider-a',
          gameId: 'game-1',
          playerId: 'player-1',
          externalTransactionId: 'bet-1',
          roundId: 'round-1',
          kind: 'BET',

          money: {
            currency: 'BRL',
            amount: '25.00',
          },
        };

        expect(
          calculatePayloadHash(first),
        ).toBe(
          calculatePayloadHash(second),
        );
      },
    );

    test(
      'different payload should generate different hash',
      () => {
        const first = {
          providerId: 'provider-a',
          externalTransactionId: 'bet-1',
          playerId: 'player-1',
          walletId: 'wallet-1',
          roundId: 'round-1',
          gameId: 'game-1',
          kind: 'BET',

          money: {
            amount: '25.00',
            currency: 'BRL',
          },
        };

        const second = {
          ...first,

          money: {
            amount: '50.00',
            currency: 'BRL',
          },
        };

        expect(
          calculatePayloadHash(first),
        ).not.toBe(
          calculatePayloadHash(second),
        );
      },
    );
  },
);
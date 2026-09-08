import { Money } from "../../wallet/domain/money.js";
import { FailureCode } from "./failure-code.js";
import { WagerTransactionKind } from "./wager-transaction-kind.js";
import { WagerTransactionStatus } from "./wager-transaction-status.js";


export interface CreateWagerTransactionProps {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;

  walletId: string;
  playerId: string;

  roundId: string;
  gameId: string;

  kind: WagerTransactionKind;
  money: Money;

  referenceExternalTransactionId?: string;

  createdAt?: Date;
}

export interface WagerTransactionState {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;

  walletId: string;
  playerId: string;

  roundId: string;
  gameId: string;

  kind: WagerTransactionKind;
  money: Money;

  referenceExternalTransactionId?: string;

  createdAt: Date;

  status: WagerTransactionStatus;
  referenceTransactionId?: string;
  failureCode?: FailureCode;
  processedAt?: Date;
}

export class WagerTransaction {
  private constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly externalTransactionId: string,
    public readonly idempotencyKey: string,
    public readonly payloadHash: string,

    public readonly walletId: string,
    public readonly playerId: string,

    public readonly roundId: string,
    public readonly gameId: string,

    public readonly kind: WagerTransactionKind,
    public readonly money: Money,

    public readonly referenceExternalTransactionId:
      | string
      | undefined,

    public readonly createdAt: Date,

    private _status: WagerTransactionStatus,

    private _referenceTransactionId?: string,

    private _failureCode?: FailureCode,

    private _processedAt?: Date,
  ) {}

  static create(
    props: CreateWagerTransactionProps,
  ): WagerTransaction {
    if (!props.id) {
      throw new Error('Transaction id is required');
    }

    if (!props.providerId) {
      throw new Error(
        'Provider id is required',
      );
    }

    if (!props.externalTransactionId) {
      throw new Error(
        'External transaction id is required',
      );
    }

    if (!props.idempotencyKey) {
      throw new Error(
        'Idempotency key is required',
      );
    }

    if (!props.payloadHash) {
      throw new Error(
        'Payload hash is required',
      );
    }

    if (
      props.money.isZero() ||
      props.money.isNegative()
    ) {
      throw new Error(
        'Transaction amount must be positive',
      );
    }

    if (
      props.kind ===
        WagerTransactionKind.Refund ||
      props.kind ===
        WagerTransactionKind.Rollback
    ) {
      if (
        !props.referenceExternalTransactionId
      ) {
        throw new Error(
          'Reference is required for this transaction',
        );
      }
    }

    if (
      props.kind !==
        WagerTransactionKind.Refund &&
      props.kind !==
        WagerTransactionKind.Rollback &&
      props.referenceExternalTransactionId
    ) {
      throw new Error(
        'Reference is not allowed for this transaction type',
      );
    }

    if (
      props.kind ===
      WagerTransactionKind.Opening
    ) {
      throw new Error(
        'OPENING transactions are internal only',
      );
    }

    return new WagerTransaction(
      props.id,
      props.providerId,
      props.externalTransactionId,
      props.idempotencyKey,
      props.payloadHash,

      props.walletId,
      props.playerId,

      props.roundId,
      props.gameId,

      props.kind,
      props.money,

      props.referenceExternalTransactionId,

      props.createdAt ?? new Date(),

      WagerTransactionStatus.Pending,
    );
  }

  static rehydrate(
    state: WagerTransactionState,
  ): WagerTransaction {
    return new WagerTransaction(
      state.id,
      state.providerId,
      state.externalTransactionId,
      state.idempotencyKey,
      state.payloadHash,

      state.walletId,
      state.playerId,

      state.roundId,
      state.gameId,

      state.kind,
      state.money,

      state.referenceExternalTransactionId,

      state.createdAt,

      state.status,

      state.referenceTransactionId,

      state.failureCode,

      state.processedAt,
    );
  }

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId():
    | string
    | undefined {
    return this._referenceTransactionId;
  }

  get failureCode():
    | FailureCode
    | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  isTerminal(): boolean {
    return (
      this._status ===
        WagerTransactionStatus.Processed ||
      this._status ===
        WagerTransactionStatus.Rejected ||
      this._status ===
        WagerTransactionStatus.Failed
    );
  }

  requiresReference(): boolean {
    return (
      this.kind ===
        WagerTransactionKind.Refund ||
      this.kind ===
        WagerTransactionKind.Rollback
    );
  }

  affectsBalance(): boolean {
    return (
      this.kind !==
      WagerTransactionKind.Loss
    );
  }

  matchesPayload(
    payloadHash: string,
  ): boolean {
    return this.payloadHash === payloadHash;
  }

  markProcessed(
    referenceTransactionId: string | undefined,
    at: Date,
  ): void {
    this.assertNotTerminal();

    this._status =
      WagerTransactionStatus.Processed;

    this._referenceTransactionId =
      referenceTransactionId;

    this._processedAt = at;
    this._failureCode = undefined;
  }

  markPendingReference(): void {
    this.assertNotTerminal();

    this._status =
      WagerTransactionStatus.PendingReference;
  }

  reject(code: FailureCode): void {
    this.assertNotTerminal();

    this._status =
      WagerTransactionStatus.Rejected;

    this._failureCode = code;
  }

  fail(code: FailureCode): void {
    this.assertNotTerminal();

    this._status =
      WagerTransactionStatus.Failed;

    this._failureCode = code;
  }

  private assertNotTerminal(): void {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition terminal transaction ${this.id}`,
      );
    }
  }
}
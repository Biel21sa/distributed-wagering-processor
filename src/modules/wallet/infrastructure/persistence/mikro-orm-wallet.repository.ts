import {
  EntityManager,
  LockMode,
} from '@mikro-orm/postgresql';
import { WalletRepository } from '../../../wagering/application/ports/wallet-repository.port.js';
import { Wallet } from '../../domain/wallet.js';
import { WalletEntity } from './wallet.entity.js';
import { WalletMapper } from './wallet.mapper.js';

export class MikroOrmWalletRepository
  implements WalletRepository
{
  async findById(
    em: EntityManager,
    id: string,
  ): Promise<Wallet | null> {
    const entity =
      await em.findOne(
        WalletEntity,
        { id },
      );

    if (!entity) {
      return null;
    }

    return WalletMapper.toDomain(
      entity,
    );
  }

  async findByIdForUpdate(
    em: EntityManager,
    id: string,
  ): Promise<Wallet | null> {
    const entity =
      await em.findOne(
        WalletEntity,
        { id },
        {
          lockMode:
            LockMode.PESSIMISTIC_WRITE,
        },
      );

    if (!entity) {
      return null;
    }

    return WalletMapper.toDomain(
      entity,
    );
  }

  async save(
    em: EntityManager,
    wallet: Wallet,
  ): Promise<void> {
    const entity =
      await em.findOne(
        WalletEntity,
        { id: wallet.id },
      );

    if (!entity) {
      throw new Error(
        `Wallet ${wallet.id} not found`,
      );
    }

    WalletMapper.updateEntity(
      entity,
      wallet,
    );

    em.persist(entity);
  }
}
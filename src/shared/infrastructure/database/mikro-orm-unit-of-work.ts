import {
  EntityManager,
} from '@mikro-orm/postgresql';
import { UnitOfWork } from './unit-of-work.js';

export class MikroOrmUnitOfWork
  implements UnitOfWork
{
  constructor(
    private readonly em: EntityManager,
  ) {}

  execute<T>(
    callback: (
      em: EntityManager,
    ) => Promise<T>,
  ): Promise<T> {
    return this.em.transactional(
      async (transactionalEm) => {
        return callback(
          transactionalEm,
        );
      },
      {
        clear: true,
      },
    );
  }
}
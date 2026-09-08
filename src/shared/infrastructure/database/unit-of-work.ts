import {
  EntityManager,
} from '@mikro-orm/postgresql';

export interface UnitOfWork {
  execute<T>(
    callback: (
      em: EntityManager,
    ) => Promise<T>,
  ): Promise<T>;
}
import 'reflect-metadata';

import {
  MikroORM,
} from '@mikro-orm/postgresql';
import mikroOrmConfig from '../../mikro-orm.config.js';

export async function createTestOrm() {
  return MikroORM.init({
    ...mikroOrmConfig,

    dbName:
      process.env.DB_NAME ??
      'wagering_test',
  });
}
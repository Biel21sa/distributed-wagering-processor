import 'dotenv/config';

import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

export default defineConfig({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  dbName: process.env.DB_NAME ?? 'wagering',
  user: process.env.DB_USERNAME ?? 'wagering',
  password: process.env.DB_PASSWORD ?? 'wagering',

  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],

  migrations: {
    path: './migrations',
  },

  extensions: [Migrator],

  debug: process.env.MIKRO_ORM_DEBUG === 'true',
});
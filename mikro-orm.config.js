import 'dotenv/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { WalletEntity } from './src/modules/wallet/infrastructure/persistence/wallet.entity.js';
export default defineConfig({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    dbName: process.env.DB_NAME ?? 'wagering',
    user: process.env.DB_USERNAME ?? 'wagering',
    password: process.env.DB_PASSWORD ?? 'wagering',
    entities: [WalletEntity],
    metadataProvider: ReflectMetadataProvider,
    migrations: {
        path: './migrations',
    },
    extensions: [
        Migrator,
    ],
    debug: process.env.MIKRO_ORM_DEBUG === 'true',
});
//# sourceMappingURL=mikro-orm.config.js.map
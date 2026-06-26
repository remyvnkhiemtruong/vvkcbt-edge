import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Monorepo root .env (apps/api/src/database -> ../../../../)
dotenv.config({ path: resolve(__dirname, '../../../../.env') });
dotenv.config();

export default new DataSource({  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});

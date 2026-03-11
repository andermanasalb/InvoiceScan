import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// .env lives at the monorepo root, two levels up from packages/backend/
dotenv.config({ path: join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, 'src/infrastructure/db/entities/*.orm-entity.{ts,js}')],
  migrations: [join(__dirname, 'src/infrastructure/db/migrations/*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

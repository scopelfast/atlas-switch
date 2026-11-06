import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL não foi configurada');
}

type PostgresClient = ReturnType<typeof postgres>;

const globalForPostgres = globalThis as unknown as {
  postgresClient?: PostgresClient;
};

const client =
  globalForPostgres.postgresClient ||
  postgres(process.env.POSTGRES_URL, {
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connection: { TimeZone: 'UTC' },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresClient = client;
}

export { client };
export const db = drizzle(client, { schema });

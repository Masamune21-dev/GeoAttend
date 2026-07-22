import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Singleton koneksi agar hot-reload dev tidak membuat koneksi baru terus-menerus
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn =
  globalForDb.conn ??
  postgres(process.env.DATABASE_URL ?? 'postgresql://geoattend:geoattend_dev_password@localhost:5432/geoattend', {
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });

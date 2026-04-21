import pg from 'pg';
import { loadEnv } from './loadEnv.js';
import { buildPgConnectionConfig } from './pgConnectionConfig.js';

const { Pool } = pg;

loadEnv();

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.warn('DATABASE_URL is not set. PostgreSQL API requests will fail until it is configured.');
}

export const pool = new Pool({
  ...buildPgConnectionConfig(databaseUrl),
});

export async function query(text, params) {
  return pool.query(text, params);
}
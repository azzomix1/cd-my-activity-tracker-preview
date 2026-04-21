import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv } from '../server/lib/loadEnv.js';
import { buildPgConnectionConfig } from '../server/lib/pgConnectionConfig.js';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../server/migrations');

loadEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const client = new Client({
    ...buildPgConnectionConfig(databaseUrl),
  });

  await client.connect();

  try {
    const entries = await fs.readdir(migrationsDir);
    const migrationFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationsDir, fileName);
      const sql = await fs.readFile(filePath, 'utf8');
      process.stdout.write(`Applying ${fileName}...\n`);
      await client.query(sql);
    }

    process.stdout.write('Database migrations completed successfully.\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
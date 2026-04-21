import { URL } from 'node:url';
import { buildPgSslConfig } from './pgSsl.js';

export function buildPgConnectionConfig(databaseUrl) {
  if (!databaseUrl) {
    return { connectionString: databaseUrl, ssl: false };
  }

  const parsed = new URL(databaseUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: buildPgSslConfig(databaseUrl),
  };
}
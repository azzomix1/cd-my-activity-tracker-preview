import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getDefaultRootCertPath() {
  return path.join(os.homedir(), '.postgresql', 'root.crt');
}

export function buildPgSslConfig(databaseUrl) {
  if (!databaseUrl || /sslmode=disable/i.test(databaseUrl)) {
    return false;
  }

  const certPath = process.env.DATABASE_SSL_ROOT_CERT?.trim() || getDefaultRootCertPath();

  if (fs.existsSync(certPath)) {
    return {
      ca: fs.readFileSync(certPath, 'utf8'),
      rejectUnauthorized: true,
    };
  }

  return { rejectUnauthorized: false };
}
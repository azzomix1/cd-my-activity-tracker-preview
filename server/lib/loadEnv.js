import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

let loaded = false;

export function loadEnv() {
  if (loaded) {
    return;
  }

  const projectRoot = path.resolve(process.cwd());
  const envFiles = ['.env.local', '.env'];

  for (const fileName of envFiles) {
    const filePath = path.join(projectRoot, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    dotenv.config({
      path: filePath,
      override: fileName === '.env.local',
      quiet: true,
    });
  }

  loaded = true;
}
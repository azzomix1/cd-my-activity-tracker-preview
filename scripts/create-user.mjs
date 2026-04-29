import { createUser } from '../server/lib/authRepository.js';
import { pool } from '../server/lib/db.js';

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '');
  const displayName = String(process.argv[4] || '').trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  const roleArg = String(process.argv[5] || '').trim().toLowerCase();
  const role = roleArg === 'administrator'
    || roleArg === 'employee'
    || roleArg === 'line_manager'
    || roleArg === 'full_manager'
    || roleArg === 'support_sales_head'
    || roleArg === 'support_sales_manager'
      ? roleArg
      : roleArg === 'admin'
        ? 'administrator'
        : roleArg === 'manager'
          ? 'full_manager'
          : roleArg === 'sales_head'
            ? 'support_sales_head'
            : roleArg === 'sales_manager'
              ? 'support_sales_manager'
          : 'employee';

  if (!email || !password) {
    throw new Error('Usage: npm run auth:create-user -- <email> <password> [displayName] [administrator|employee|line_manager|full_manager|support_sales_head|support_sales_manager]');
  }

  const createdUser = await createUser({
    email,
    password,
    displayName,
    role,
  });

  process.stdout.write(`User created: ${createdUser.email} (${createdUser.role})\n`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

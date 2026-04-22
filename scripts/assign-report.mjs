import { pool } from '../server/lib/db.js';
import { findUserByEmail } from '../server/lib/authRepository.js';
import { query } from '../server/lib/db.js';

async function main() {
  const managerEmail = String(process.argv[2] || '').trim().toLowerCase();
  const employeeEmail = String(process.argv[3] || '').trim().toLowerCase();

  if (!managerEmail || !employeeEmail) {
    throw new Error('Usage: npm run auth:assign-report -- <managerEmail> <employeeEmail>');
  }

  const manager = await findUserByEmail(managerEmail);
  const employee = await findUserByEmail(employeeEmail);

  if (!manager) {
    throw new Error(`Manager is not found: ${managerEmail}`);
  }

  if (!employee) {
    throw new Error(`Employee is not found: ${employeeEmail}`);
  }

  await query(
    `
      insert into user_hierarchy (manager_user_id, employee_user_id)
      values ($1, $2)
      on conflict (manager_user_id, employee_user_id) do nothing
    `,
    [manager.id, employee.id],
  );

  process.stdout.write(`Assigned: ${manager.email} -> ${employee.email}\n`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

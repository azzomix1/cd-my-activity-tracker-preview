import { findUserByEmail } from '../server/lib/authRepository.js';
import { pool, query } from '../server/lib/db.js';

async function main() {
  const alias = String(process.argv[2] || '').trim();
  const userEmail = String(process.argv[3] || '').trim().toLowerCase();

  if (!alias || !userEmail) {
    throw new Error('Usage: npm run auth:map-person-alias -- <alias> <userEmail>');
  }

  const user = await findUserByEmail(userEmail);

  if (!user) {
    throw new Error(`User is not found: ${userEmail}`);
  }

  await query(
    `
      insert into activity_person_alias_map (alias, user_id)
      values ($1, $2)
      on conflict (alias)
      do update set
        user_id = excluded.user_id,
        updated_at = now()
    `,
    [alias, user.id],
  );

  await query(
    `
      update activities
      set employee_user_id = $1
      where employee_user_id is null
        and lower(trim(person)) = lower(trim($2))
    `,
    [user.id, alias],
  );

  process.stdout.write(`Alias mapped: ${alias} -> ${user.email}\n`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

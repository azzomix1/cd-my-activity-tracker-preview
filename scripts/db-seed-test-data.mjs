import { pool, query } from '../server/lib/db.js';
import { buildPasswordHash } from '../server/lib/authRepository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_USERS = [
  {
    id: 'seed-user-admin',
    email: 'demo.admin@example.com',
    password: 'DemoPass123!',
    displayName: 'Demo Admin',
    role: 'administrator',
  },
  {
    id: 'seed-user-full-manager',
    email: 'demo.fullmanager@example.com',
    password: 'DemoPass123!',
    displayName: 'Demo Full Manager',
    role: 'full_manager',
  },
  {
    id: 'seed-user-line-manager',
    email: 'demo.manager@example.com',
    password: 'DemoPass123!',
    displayName: 'Demo Line Manager',
    role: 'line_manager',
  },
  {
    id: 'seed-user-employee-anna',
    email: 'anna.employee@example.com',
    password: 'DemoPass123!',
    displayName: 'Anna Employee',
    role: 'employee',
  },
  {
    id: 'seed-user-employee-ivan',
    email: 'ivan.employee@example.com',
    password: 'DemoPass123!',
    displayName: 'Ivan Employee',
    role: 'employee',
  },
];

const TEST_HIERARCHY = [
  { managerEmail: 'demo.manager@example.com', employeeEmail: 'anna.employee@example.com' },
  { managerEmail: 'demo.manager@example.com', employeeEmail: 'ivan.employee@example.com' },
];

function toIsoDate(offsetDays) {
  const base = new Date(Date.now() + offsetDays * DAY_MS);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toRuDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}.${month}.${year}`;
}

function buildActivities(usersByEmail) {
  const anna = usersByEmail.get('anna.employee@example.com');
  const ivan = usersByEmail.get('ivan.employee@example.com');

  return [
    {
      id: 'seed-activity-01',
      date: toIsoDate(1),
      time: '10:00:00',
      name: 'Pipeline review meeting',
      person: 'Anna Employee',
      objects: 'CRM / weekly sync',
      eventType: 'internal',
      visibility: 'private',
      employeeUserId: anna.id,
    },
    {
      id: 'seed-activity-02',
      date: toIsoDate(2),
      time: '14:30:00',
      name: 'Client onboarding call',
      person: 'Anna Employee',
      objects: 'Client A onboarding',
      eventType: 'external',
      visibility: 'public',
      employeeUserId: anna.id,
    },
    {
      id: 'seed-activity-03',
      date: toIsoDate(-1),
      time: '11:15:00',
      name: 'Quarter backlog grooming',
      person: 'Ivan Employee',
      objects: 'Backlog / priorities',
      eventType: 'internal',
      visibility: 'private',
      employeeUserId: ivan.id,
    },
    {
      id: 'seed-activity-04',
      date: toIsoDate(0),
      time: '16:00:00',
      name: 'Ops standup and blockers',
      person: 'Ivan Employee',
      objects: 'Ops board',
      eventType: 'internal',
      visibility: 'public',
      employeeUserId: ivan.id,
    },
    {
      id: 'seed-activity-05',
      date: toIsoDate(3),
      time: null,
      name: 'Documentation update session',
      person: 'Anna Employee',
      objects: 'Knowledge base',
      eventType: 'internal',
      visibility: 'public',
      employeeUserId: anna.id,
    },
    {
      id: 'seed-activity-06',
      date: toIsoDate(-3),
      time: '09:40:00',
      name: 'Postmortem draft review',
      person: 'Ivan Employee',
      objects: 'Incident follow-up',
      eventType: 'external',
      visibility: 'private',
      employeeUserId: ivan.id,
    },
  ];
}

function buildReportPayload(activity, suffix) {
  return {
    date: toRuDate(activity.date),
    time: activity.time ? String(activity.time).slice(0, 5) : '',
    employeeName: activity.person,
    meetingContent: `${activity.name} (${suffix})`,
    meetingFormat: 'Online call',
    projects: ['Project Atlas', 'Project Beacon'],
    notificationsCount: '3',
    telegramSubscriptionsCount: '1',
    comment: `Seeded report for ${activity.id}`,
    updatedAt: new Date().toISOString(),
  };
}

function buildDraftPayload(activity, suffix) {
  return {
    date: toRuDate(activity.date),
    time: activity.time ? String(activity.time).slice(0, 5) : '',
    employeeName: activity.person,
    meetingContent: `${activity.name} (${suffix})`,
    meetingFormat: 'Draft mode',
    projects: ['Draft Project'],
    notificationsCount: '0',
    telegramSubscriptionsCount: '0',
    comment: `Seeded draft for ${activity.id}`,
    updatedAt: new Date().toISOString(),
  };
}

async function upsertUser(user) {
  const result = await query(
    `
      insert into app_users (
        id,
        email,
        password_hash,
        display_name,
        role,
        is_active
      ) values ($1, $2, $3, $4, $5, true)
      on conflict (email)
      do update set
        password_hash = excluded.password_hash,
        display_name = excluded.display_name,
        role = excluded.role,
        is_active = true,
        updated_at = now()
      returning id, email, display_name, role
    `,
    [
      user.id,
      user.email,
      buildPasswordHash(user.password),
      user.displayName,
      user.role,
    ],
  );

  return result.rows[0];
}

async function upsertHierarchy(usersByEmail) {
  for (const link of TEST_HIERARCHY) {
    const manager = usersByEmail.get(link.managerEmail);
    const employee = usersByEmail.get(link.employeeEmail);

    if (!manager || !employee) {
      throw new Error(`Hierarchy seed user is missing: ${link.managerEmail} -> ${link.employeeEmail}`);
    }

    await query(
      `
        insert into user_hierarchy (manager_user_id, employee_user_id)
        values ($1, $2)
        on conflict (manager_user_id, employee_user_id) do nothing
      `,
      [manager.id, employee.id],
    );
  }
}

async function upsertAlias(alias, userId) {
  await query(
    `
      insert into activity_person_alias_map (alias, user_id)
      values ($1, $2)
      on conflict (alias)
      do update set
        user_id = excluded.user_id,
        updated_at = now()
    `,
    [alias, userId],
  );
}

async function upsertActivity(activity) {
  await query(
    `
      insert into activities (
        id,
        event_date,
        event_time,
        name,
        person,
        objects,
        event_type,
        visibility,
        employee_user_id
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (id)
      do update set
        event_date = excluded.event_date,
        event_time = excluded.event_time,
        name = excluded.name,
        person = excluded.person,
        objects = excluded.objects,
        event_type = excluded.event_type,
        visibility = excluded.visibility,
        employee_user_id = excluded.employee_user_id,
        updated_at = now()
    `,
    [
      activity.id,
      activity.date,
      activity.time,
      activity.name,
      activity.person,
      activity.objects,
      activity.eventType,
      activity.visibility,
      activity.employeeUserId,
    ],
  );
}

async function upsertReport(activityId, payload) {
  await query(
    `
      insert into activity_reports (activity_id, report_data)
      values ($1, $2::jsonb)
      on conflict (activity_id)
      do update set
        report_data = excluded.report_data,
        updated_at = now()
    `,
    [activityId, JSON.stringify(payload)],
  );
}

async function upsertDraft(activityId, payload) {
  await query(
    `
      insert into activity_report_drafts (activity_id, draft_data)
      values ($1, $2::jsonb)
      on conflict (activity_id)
      do update set
        draft_data = excluded.draft_data,
        updated_at = now()
    `,
    [activityId, JSON.stringify(payload)],
  );
}

async function main() {
  const users = [];
  for (const user of TEST_USERS) {
    const saved = await upsertUser(user);
    users.push(saved);
  }

  const usersByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));

  await upsertHierarchy(usersByEmail);

  await upsertAlias('Anna Employee', usersByEmail.get('anna.employee@example.com').id);
  await upsertAlias('Ivan Employee', usersByEmail.get('ivan.employee@example.com').id);

  const activities = buildActivities(usersByEmail);
  for (const activity of activities) {
    await upsertActivity(activity);
  }

  const reportsTargets = [activities[0], activities[1]];
  const draftsTargets = [activities[2], activities[3]];

  for (const activity of reportsTargets) {
    await upsertReport(activity.id, buildReportPayload(activity, 'final'));
  }

  for (const activity of draftsTargets) {
    await upsertDraft(activity.id, buildDraftPayload(activity, 'draft'));
  }

  const seededActivityIds = activities.map((activity) => activity.id);
  const seededUsersEmails = TEST_USERS.map((user) => user.email);

  const [usersCountResult, activitiesCountResult, reportsCountResult, draftsCountResult] = await Promise.all([
    query('select count(*)::int as c from app_users where email = any($1::text[])', [seededUsersEmails]),
    query('select count(*)::int as c from activities where id = any($1::text[])', [seededActivityIds]),
    query('select count(*)::int as c from activity_reports where activity_id = any($1::text[])', [seededActivityIds]),
    query('select count(*)::int as c from activity_report_drafts where activity_id = any($1::text[])', [seededActivityIds]),
  ]);

  process.stdout.write('TEST_DATA_SEED: PASS\n');
  process.stdout.write(`SEED_USERS=${usersCountResult.rows[0].c}\n`);
  process.stdout.write(`SEED_ACTIVITIES=${activitiesCountResult.rows[0].c}\n`);
  process.stdout.write(`SEED_REPORTS=${reportsCountResult.rows[0].c}\n`);
  process.stdout.write(`SEED_DRAFTS=${draftsCountResult.rows[0].c}\n`);
  process.stdout.write('SEED_LOGIN_PASSWORD=DemoPass123!\n');
  for (const user of TEST_USERS) {
    process.stdout.write(`SEED_LOGIN=${user.email} (${user.role})\n`);
  }
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

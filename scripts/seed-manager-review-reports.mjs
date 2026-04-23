import { randomUUID } from 'node:crypto';
import { pool, query } from '../server/lib/db.js';

const TARGET_ROLES = ['employee', 'line_manager'];
const MIN_REPORTS_PER_USER = 2;
const MAX_REPORTS_PER_USER = 3;

function toRuDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}.${month}.${year}`;
}

function toIsoDateFromOffset(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDisplayName(user) {
  return String(user.display_name || user.email || user.id).trim();
}

function buildReportPayload(activity, userLabel) {
  const eventDate = String(activity.event_date || '').slice(0, 10);

  return {
    date: toRuDate(eventDate),
    time: activity.event_time ? String(activity.event_time).slice(0, 5) : '',
    employeeName: userLabel,
    meetingContent: `${activity.name || 'Рабочая встреча'} (финальный отчет)`,
    meetingFormat: 'Рабочая встреча',
    projects: ['Проверка кабинета', 'Контроль отчетности'],
    notificationsCount: '2',
    telegramSubscriptionsCount: '1',
    comment: `Auto-seeded manager review report for ${activity.id}`,
    updatedAt: new Date().toISOString(),
  };
}

async function ensureActivityWithReport(user, sequenceIndex) {
  const id = `seed-review-${user.role}-${String(user.id).slice(0, 8)}-${sequenceIndex}-${randomUUID().slice(0, 8)}`;
  const eventDate = toIsoDateFromOffset(-(sequenceIndex + 1));
  const eventTime = `${String(9 + sequenceIndex).padStart(2, '0')}:30:00`;
  const userLabel = normalizeDisplayName(user);

  await query(
    `
      insert into activities (
        id,
        employee_user_id,
        event_date,
        event_time,
        name,
        person,
        objects,
        event_type,
        visibility
      ) values ($1, $2, $3, $4, $5, $6, $7, 'internal', 'public')
    `,
    [
      id,
      user.id,
      eventDate,
      eventTime,
      `Контрольная активность ${sequenceIndex + 1}`,
      userLabel,
      'Кабинет руководителя, Проверка отчетов',
    ],
  );

  const payload = {
    date: toRuDate(eventDate),
    time: eventTime.slice(0, 5),
    employeeName: userLabel,
    meetingContent: `Контрольная активность ${sequenceIndex + 1}`,
    meetingFormat: 'Проверка',
    projects: ['Audit', 'Team review'],
    notificationsCount: '1',
    telegramSubscriptionsCount: '0',
    comment: `Auto-created report for ${userLabel}`,
    updatedAt: new Date().toISOString(),
  };

  await query(
    `
      insert into activity_reports (activity_id, report_data)
      values ($1, $2::jsonb)
      on conflict (activity_id)
      do update set
        report_data = excluded.report_data,
        updated_at = now()
    `,
    [id, JSON.stringify(payload)],
  );

  return id;
}

async function upsertReportsForUser(user) {
  const userLabel = normalizeDisplayName(user);
  const existing = await query(
    `
      select
        a.id,
        a.event_date,
        a.event_time,
        a.name
      from activities a
      where a.employee_user_id = $1
      order by a.event_date desc, a.event_time desc nulls last
      limit 3
    `,
    [user.id],
  );

  const targetCount = Math.min(MAX_REPORTS_PER_USER, Math.max(MIN_REPORTS_PER_USER, existing.rows.length || MIN_REPORTS_PER_USER));

  for (let i = 0; i < Math.min(targetCount, existing.rows.length); i += 1) {
    const activity = existing.rows[i];
    await query(
      `
        insert into activity_reports (activity_id, report_data)
        values ($1, $2::jsonb)
        on conflict (activity_id)
        do update set
          report_data = excluded.report_data,
          updated_at = now()
      `,
      [activity.id, JSON.stringify(buildReportPayload(activity, userLabel))],
    );
  }

  const currentReports = await query(
    `
      select count(*)::int as c
      from activities a
      join activity_reports r on r.activity_id = a.id
      where a.employee_user_id = $1
    `,
    [user.id],
  );

  let reportCount = currentReports.rows[0].c;
  const createdActivityIds = [];

  while (reportCount < MIN_REPORTS_PER_USER) {
    const createdId = await ensureActivityWithReport(user, createdActivityIds.length);
    createdActivityIds.push(createdId);

    const recount = await query(
      `
        select count(*)::int as c
        from activities a
        join activity_reports r on r.activity_id = a.id
        where a.employee_user_id = $1
      `,
      [user.id],
    );

    reportCount = recount.rows[0].c;
  }

  return {
    email: user.email,
    role: user.role,
    reports: reportCount,
    createdActivities: createdActivityIds.length,
  };
}

async function main() {
  const usersResult = await query(
    `
      select id, email, display_name, role
      from app_users
      where is_active = true
        and role = any($1::text[])
      order by role asc, display_name asc, email asc
    `,
    [TARGET_ROLES],
  );

  if (usersResult.rows.length === 0) {
    process.stdout.write('No target users found for report seeding.\n');
    return;
  }

  const summary = [];

  for (const user of usersResult.rows) {
    const result = await upsertReportsForUser(user);
    summary.push(result);
  }

  process.stdout.write('REPORT_SEED_FOR_MANAGER_REVIEW: PASS\n');
  summary.forEach((row) => {
    process.stdout.write(`${row.role}\t${row.email}\treports=${row.reports}\tcreatedActivities=${row.createdActivities}\n`);
  });
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

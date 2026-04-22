import { query, pool } from '../server/lib/db.js';

function printMetric(label, value) {
  process.stdout.write(`${label}=${value}\n`);
}

async function getInt(sql) {
  const result = await query(sql);
  return Number(result.rows[0]?.c || 0);
}

async function main() {
  const metrics = {
    activities: await getInt('select count(*)::int as c from activities'),
    reports: await getInt('select count(*)::int as c from activity_reports'),
    drafts: await getInt('select count(*)::int as c from activity_report_drafts'),
    orphanReports: await getInt('select count(*)::int as c from activity_reports r left join activities a on a.id = r.activity_id where a.id is null'),
    orphanDrafts: await getInt('select count(*)::int as c from activity_report_drafts d left join activities a on a.id = d.activity_id where a.id is null'),
    emptyActivityIds: await getInt("select count(*)::int as c from activities where trim(id) = ''"),
    nullEventDateRows: await getInt('select count(*)::int as c from activities where event_date is null'),
    activitiesWithBrokenEmployeeUserRef: await getInt('select count(*)::int as c from activities a left join app_users u on u.id = a.employee_user_id where a.employee_user_id is not null and u.id is null'),
    activitiesWithoutEmployeeUserId: await getInt('select count(*)::int as c from activities where employee_user_id is null'),
  };

  printMetric('DB_CHECK_ACTIVITIES', metrics.activities);
  printMetric('DB_CHECK_REPORTS', metrics.reports);
  printMetric('DB_CHECK_DRAFTS', metrics.drafts);
  printMetric('DB_CHECK_ORPHAN_REPORTS', metrics.orphanReports);
  printMetric('DB_CHECK_ORPHAN_DRAFTS', metrics.orphanDrafts);
  printMetric('DB_CHECK_EMPTY_ACTIVITY_IDS', metrics.emptyActivityIds);
  printMetric('DB_CHECK_NULL_EVENT_DATES', metrics.nullEventDateRows);
  printMetric('DB_CHECK_BROKEN_EMPLOYEE_REFS', metrics.activitiesWithBrokenEmployeeUserRef);
  printMetric('DB_CHECK_MISSING_EMPLOYEE_IDS', metrics.activitiesWithoutEmployeeUserId);

  const hasCriticalIssue =
    metrics.orphanReports > 0
    || metrics.orphanDrafts > 0
    || metrics.emptyActivityIds > 0
    || metrics.nullEventDateRows > 0
    || metrics.activitiesWithBrokenEmployeeUserRef > 0;

  if (hasCriticalIssue) {
    process.stdout.write('DB_INTEGRITY_CHECK: FAIL\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write('DB_INTEGRITY_CHECK: PASS\n');
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

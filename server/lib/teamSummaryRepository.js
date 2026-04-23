import { query } from './db.js';

function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function normalizeIsoDate(value, fieldName) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  if (!isIsoDateString(normalized)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format.`);
  }

  return normalized;
}

function buildIntegerJsonbMetricExpression(columnName, fieldName) {
  return `case
    when coalesce(${columnName}->>'${fieldName}', '') ~ '^-?\\d+$'
      then (${columnName}->>'${fieldName}')::int
    else 0
  end`;
}

function buildActivityWhereClause(employeeUserIds, startDate, endDate) {
  const params = [employeeUserIds];
  const conditions = ['a.employee_user_id = any($1::text[])'];

  if (startDate) {
    params.push(startDate);
    conditions.push(`a.event_date >= $${params.length}::date`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`a.event_date <= $${params.length}::date`);
  }

  return {
    params,
    whereClause: conditions.join(' and '),
  };
}

function buildDefaultSummary(startDate, endDate) {
  return {
    scope: {
      startDate,
      endDate,
      employeesCount: 0,
    },
    overview: {
      totalActivities: 0,
      completedReports: 0,
      missingReports: 0,
      draftReports: 0,
      notificationsTotal: 0,
      telegramSubscriptionsTotal: 0,
    },
    employees: [],
    projects: [],
    reports: [],
  };
}

function buildOverview(employees) {
  return employees.reduce((result, employee) => ({
    totalActivities: result.totalActivities + employee.totalActivities,
    completedReports: result.completedReports + employee.completedReports,
    missingReports: result.missingReports + employee.missingReports,
    draftReports: result.draftReports + employee.draftReports,
    notificationsTotal: result.notificationsTotal + employee.notificationsTotal,
    telegramSubscriptionsTotal: result.telegramSubscriptionsTotal + employee.telegramSubscriptionsTotal,
  }), {
    totalActivities: 0,
    completedReports: 0,
    missingReports: 0,
    draftReports: 0,
    notificationsTotal: 0,
    telegramSubscriptionsTotal: 0,
  });
}

export async function getTeamSummary({ employees = [], startDate, endDate }) {
  const normalizedStartDate = normalizeIsoDate(startDate, 'startDate');
  const normalizedEndDate = normalizeIsoDate(endDate, 'endDate');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    throw new Error('startDate must be less than or equal to endDate.');
  }

  const normalizedEmployees = Array.isArray(employees)
    ? employees.filter((employee) => String(employee?.id || '').trim())
    : [];

  if (normalizedEmployees.length === 0) {
    return buildDefaultSummary(normalizedStartDate, normalizedEndDate);
  }

  const employeeUserIds = normalizedEmployees.map((employee) => String(employee.id).trim());
  const notificationsMetric = buildIntegerJsonbMetricExpression('r.report_data', 'notificationsCount');
  const subscriptionsMetric = buildIntegerJsonbMetricExpression('r.report_data', 'telegramSubscriptionsCount');
  const { params, whereClause } = buildActivityWhereClause(
    employeeUserIds,
    normalizedStartDate,
    normalizedEndDate,
  );

  const employeesResult = await query(
    `
      select
        u.id,
        u.email,
        u.display_name,
        count(a.id)::int as total_activities,
        count(r.activity_id)::int as completed_reports,
        count(d.activity_id)::int as draft_reports,
        count(*) filter (where a.id is not null and a.event_date < current_date and r.activity_id is null)::int as missing_reports,
        coalesce(sum(case when r.activity_id is not null then ${notificationsMetric} else 0 end), 0)::int as notifications_total,
        coalesce(sum(case when r.activity_id is not null then ${subscriptionsMetric} else 0 end), 0)::int as telegram_subscriptions_total
      from unnest($1::text[]) as scope(employee_user_id)
      join app_users u on u.id = scope.employee_user_id
      left join activities a
        on a.employee_user_id = u.id
       and ${whereClause.replaceAll('a.employee_user_id = any($1::text[]) and ', '').replace('a.employee_user_id = any($1::text[])', '1 = 1')}
      left join activity_reports r on r.activity_id = a.id
      left join activity_report_drafts d on d.activity_id = a.id
      group by u.id, u.email, u.display_name
      order by missing_reports desc, total_activities desc, u.display_name asc, u.email asc
    `,
    params,
  );

  const projectsResult = await query(
    `
      with scoped_reports as (
        select
          a.employee_user_id,
          r.report_data
        from activities a
        join activity_reports r on r.activity_id = a.id
        where ${whereClause}
      ),
      exploded_projects as (
        select
          sr.employee_user_id,
          trim(project_name.value) as project_name,
          sr.report_data
        from scoped_reports sr
        cross join lateral jsonb_array_elements_text(
          case
            when jsonb_typeof(sr.report_data->'projects') = 'array' then sr.report_data->'projects'
            else '[]'::jsonb
          end
        ) as project_name(value)
      )
      select
        project_name,
        count(*)::int as reports_count,
        count(distinct employee_user_id)::int as employees_count,
        coalesce(sum(${buildIntegerJsonbMetricExpression('report_data', 'notificationsCount')}), 0)::int as notifications_total,
        coalesce(sum(${buildIntegerJsonbMetricExpression('report_data', 'telegramSubscriptionsCount')}), 0)::int as telegram_subscriptions_total
      from exploded_projects
      where project_name <> ''
      group by project_name
      order by reports_count desc, employees_count desc, project_name asc
    `,
    params,
  );

  const reportsResult = await query(
    `
      select
        a.id as activity_id,
        a.employee_user_id,
        coalesce(u.display_name, u.email, a.person, '') as employee_display_name,
        coalesce(u.email, '') as employee_email,
        to_char(a.event_date, 'DD.MM.YYYY') as event_date,
        to_char(a.event_time, 'HH24:MI:SS') as event_time,
        a.name as activity_name,
        a.person,
        a.objects,
        a.event_type,
        a.visibility,
        r.report_data
      from activities a
      join activity_reports r on r.activity_id = a.id
      left join app_users u on u.id = a.employee_user_id
      where ${whereClause}
      order by a.event_date desc, a.event_time desc nulls last, a.name asc
      limit 200
    `,
    params,
  );

  const employeeSummaries = employeesResult.rows.map((row) => ({
    employeeUserId: String(row.id),
    email: String(row.email || ''),
    displayName: String(row.display_name || row.email || row.id || ''),
    totalActivities: Number(row.total_activities || 0),
    completedReports: Number(row.completed_reports || 0),
    missingReports: Number(row.missing_reports || 0),
    draftReports: Number(row.draft_reports || 0),
    notificationsTotal: Number(row.notifications_total || 0),
    telegramSubscriptionsTotal: Number(row.telegram_subscriptions_total || 0),
    completionRate: Number(row.total_activities || 0) > 0
      ? Math.round((Number(row.completed_reports || 0) / Number(row.total_activities || 0)) * 100)
      : 0,
  }));

  const projectSummaries = projectsResult.rows.map((row) => ({
    name: String(row.project_name || ''),
    reportsCount: Number(row.reports_count || 0),
    employeesCount: Number(row.employees_count || 0),
    notificationsTotal: Number(row.notifications_total || 0),
    telegramSubscriptionsTotal: Number(row.telegram_subscriptions_total || 0),
  }));

  const reportItems = reportsResult.rows.map((row) => {
    const reportData = row.report_data && typeof row.report_data === 'object'
      ? row.report_data
      : {};

    return {
      activityId: String(row.activity_id || ''),
      employeeUserId: String(row.employee_user_id || ''),
      employeeDisplayName: String(row.employee_display_name || ''),
      employeeEmail: String(row.employee_email || ''),
      eventDate: String(row.event_date || ''),
      eventTime: String(row.event_time || '').slice(0, 5),
      activityName: String(row.activity_name || ''),
      person: String(row.person || ''),
      objects: String(row.objects || ''),
      eventType: String(row.event_type || 'internal'),
      visibility: String(row.visibility || 'public'),
      reportData,
      summary: {
        meetingContent: String(reportData.meetingContent || ''),
        meetingFormat: String(reportData.meetingFormat || ''),
        notificationsCount: Number(reportData.notificationsCount || 0) || 0,
        telegramSubscriptionsCount: Number(reportData.telegramSubscriptionsCount || 0) || 0,
      },
    };
  });

  return {
    scope: {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      employeesCount: normalizedEmployees.length,
    },
    overview: buildOverview(employeeSummaries),
    employees: employeeSummaries,
    projects: projectSummaries,
    reports: reportItems,
  };
}
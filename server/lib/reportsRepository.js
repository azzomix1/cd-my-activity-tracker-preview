import { query } from './db.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return [];
  }

  return normalized.split(',').map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeProjects(value, preserveEmpty) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedProjects = value.map((project) => normalizeString(project));
  return preserveEmpty ? normalizedProjects : normalizedProjects.filter(Boolean);
}

function normalizeReportPayload(payload = {}, preserveEmptyProjects = false) {
  const employeeNames = normalizeStringArray(payload.employeeNames);
  const employeeName = normalizeString(payload.employeeName);

  return {
    date: normalizeString(payload.date),
    time: normalizeString(payload.time),
    employeeName: employeeName || employeeNames.join(', '),
    employeeNames: employeeNames.length > 0 ? employeeNames : normalizeStringArray(employeeName),
    meetingContent: normalizeString(payload.meetingContent),
    meetingFormat: normalizeString(payload.meetingFormat),
    projects: normalizeProjects(payload.projects, preserveEmptyProjects),
    notificationsCount: normalizeString(payload.notificationsCount),
    telegramSubscriptionsCount: normalizeString(payload.telegramSubscriptionsCount),
    comment: normalizeString(payload.comment),
    updatedAt: normalizeString(payload.updatedAt) || new Date().toISOString(),
  };
}

function mapRowsToDictionary(rows, fieldName) {
  return rows.reduce((result, row) => {
    const compositeKey = `${String(row.activity_id)}::${String(row.employee_user_id)}`;
    result[compositeKey] = row[fieldName];
    return result;
  }, {});
}

function normalizeActivityId(activityId) {
  const normalized = String(activityId || '').trim();

  if (!normalized) {
    throw new Error('Activity id is required.');
  }

  return normalized;
}

export async function getReportsSnapshot() {
  const [reportsResult, draftsResult] = await Promise.all([
    query(
      `
        select activity_id, employee_user_id, report_data
        from activity_reports
      `,
    ),
    query(
      `
        select activity_id, employee_user_id, draft_data
        from activity_report_drafts
      `,
    ),
  ]);

  return {
    reportsByActivityId: mapRowsToDictionary(reportsResult.rows, 'report_data'),
    draftsByActivityId: mapRowsToDictionary(draftsResult.rows, 'draft_data'),
  };
}

export async function userCanManageActivityReport(activityId, employeeUserId, auth) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();
  if (!normalizedEmployeeUserId) {
    return false;
  }

  const role = String(auth?.role || '').trim().toLowerCase();
  if (role === 'administrator' || role === 'full_manager') {
    return true;
  }

  if (normalizedEmployeeUserId !== String(auth?.userId || '').trim()) {
    return false;
  }

  const result = await query(
    `
      select 1
      from activity_participants
      where activity_id = $1
        and employee_user_id = $2
      limit 1
    `,
    [normalizedActivityId, normalizedEmployeeUserId],
  );

  return result.rowCount > 0;
}

export async function upsertActivityReport(activityId, employeeUserId, reportData) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();
  if (!normalizedEmployeeUserId) {
    throw new Error('Employee user id is required.');
  }
  const normalizedReport = normalizeReportPayload(reportData, false);

  const result = await query(
    `
      insert into activity_reports (activity_id, employee_user_id, report_data)
      values ($1, $2, $3::jsonb)
      on conflict (activity_id, employee_user_id)
      do update set
        report_data = excluded.report_data,
        updated_at = now()
      returning report_data
    `,
    [normalizedActivityId, normalizedEmployeeUserId, JSON.stringify(normalizedReport)],
  );

  return result.rows[0]?.report_data || normalizedReport;
}

export async function deleteActivityReport(activityId, employeeUserId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();
  await query('delete from activity_reports where activity_id = $1 and employee_user_id = $2', [normalizedActivityId, normalizedEmployeeUserId]);
}

export async function upsertActivityReportDraft(activityId, employeeUserId, draftData) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();
  if (!normalizedEmployeeUserId) {
    throw new Error('Employee user id is required.');
  }
  const normalizedDraft = normalizeReportPayload(draftData, true);

  const result = await query(
    `
      insert into activity_report_drafts (activity_id, employee_user_id, draft_data)
      values ($1, $2, $3::jsonb)
      on conflict (activity_id, employee_user_id)
      do update set
        draft_data = excluded.draft_data,
        updated_at = now()
      returning draft_data
    `,
    [normalizedActivityId, normalizedEmployeeUserId, JSON.stringify(normalizedDraft)],
  );

  return result.rows[0]?.draft_data || normalizedDraft;
}

export async function deleteActivityReportDraft(activityId, employeeUserId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();
  await query('delete from activity_report_drafts where activity_id = $1 and employee_user_id = $2', [normalizedActivityId, normalizedEmployeeUserId]);
}
import { query } from './db.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProjects(value, preserveEmpty) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedProjects = value.map((project) => normalizeString(project));
  return preserveEmpty ? normalizedProjects : normalizedProjects.filter(Boolean);
}

function normalizeReportPayload(payload = {}, preserveEmptyProjects = false) {
  return {
    date: normalizeString(payload.date),
    time: normalizeString(payload.time),
    employeeName: normalizeString(payload.employeeName),
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
    result[String(row.activity_id)] = row[fieldName];
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
        select activity_id, report_data
        from activity_reports
      `,
    ),
    query(
      `
        select activity_id, draft_data
        from activity_report_drafts
      `,
    ),
  ]);

  return {
    reportsByActivityId: mapRowsToDictionary(reportsResult.rows, 'report_data'),
    draftsByActivityId: mapRowsToDictionary(draftsResult.rows, 'draft_data'),
  };
}

export async function upsertActivityReport(activityId, reportData) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedReport = normalizeReportPayload(reportData, false);

  const result = await query(
    `
      insert into activity_reports (activity_id, report_data)
      values ($1, $2::jsonb)
      on conflict (activity_id)
      do update set
        report_data = excluded.report_data,
        updated_at = now()
      returning report_data
    `,
    [normalizedActivityId, JSON.stringify(normalizedReport)],
  );

  return result.rows[0]?.report_data || normalizedReport;
}

export async function deleteActivityReport(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  await query('delete from activity_reports where activity_id = $1', [normalizedActivityId]);
}

export async function upsertActivityReportDraft(activityId, draftData) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedDraft = normalizeReportPayload(draftData, true);

  const result = await query(
    `
      insert into activity_report_drafts (activity_id, draft_data)
      values ($1, $2::jsonb)
      on conflict (activity_id)
      do update set
        draft_data = excluded.draft_data,
        updated_at = now()
      returning draft_data
    `,
    [normalizedActivityId, JSON.stringify(normalizedDraft)],
  );

  return result.rows[0]?.draft_data || normalizedDraft;
}

export async function deleteActivityReportDraft(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  await query('delete from activity_report_drafts where activity_id = $1', [normalizedActivityId]);
}
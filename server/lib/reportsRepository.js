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

function normalizeActor(auth = {}) {
  const email = normalizeString(auth.email);
  const displayName = normalizeString(auth.displayName) || email || 'Сотрудник';

  return {
    userId: normalizeString(auth.userId),
    displayName,
    email,
  };
}

function applyActorMetadata(reportPayload, auth, metadata) {
  const actor = normalizeActor(auth);
  const now = new Date().toISOString();

  return {
    ...reportPayload,
    updatedAt: now,
    lastUpdatedByUserId: actor.userId,
    lastUpdatedByDisplayName: actor.displayName,
    lastUpdatedByEmail: actor.email,
    ...metadata,
  };
}

export async function userCanManageActivityReport(activityId, auth) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const actor = normalizeActor(auth);
  if (!actor.userId) {
    return false;
  }

  const role = String(auth?.role || '').trim().toLowerCase();
  if (role === 'administrator' || role === 'full_manager') {
    return true;
  }

  const result = await query(
    `
      select 1
      from activity_participants
      where activity_id = $1
        and employee_user_id = $2
      limit 1
    `,
    [normalizedActivityId, actor.userId],
  );

  return result.rowCount > 0;
}

export async function getActivityReport(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const result = await query(
    `
      select report_data
      from activity_reports
      where activity_id = $1
      limit 1
    `,
    [normalizedActivityId],
  );

  return result.rows[0]?.report_data || null;
}

export async function getActivityReportDraft(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const result = await query(
    `
      select draft_data
      from activity_report_drafts
      where activity_id = $1
      limit 1
    `,
    [normalizedActivityId],
  );

  return result.rows[0]?.draft_data || null;
}

export async function upsertActivityReport(activityId, reportData, auth) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const existingReport = await getActivityReport(normalizedActivityId);
  const actor = normalizeActor(auth);
  const normalizedReport = applyActorMetadata(
    normalizeReportPayload(reportData, false),
    auth,
    {
      createdByUserId: normalizeString(existingReport?.createdByUserId) || actor.userId,
      createdByDisplayName: normalizeString(existingReport?.createdByDisplayName) || actor.displayName,
      createdByEmail: normalizeString(existingReport?.createdByEmail) || actor.email,
      completedAt: new Date().toISOString(),
      completedByUserId: actor.userId,
      completedByDisplayName: actor.displayName,
      completedByEmail: actor.email,
    },
  );

  const result = await query(
    `
      insert into activity_reports (activity_id, report_data, created_by_user_id, updated_by_user_id)
      values ($1, $2::jsonb, $3, $4)
      on conflict (activity_id)
      do update set
        report_data = excluded.report_data,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
      returning report_data
    `,
    [normalizedActivityId, JSON.stringify(normalizedReport), actor.userId || null, actor.userId || null],
  );

  return {
    item: result.rows[0]?.report_data || normalizedReport,
    wasCreated: !existingReport,
  };
}

export async function deleteActivityReport(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  await query('delete from activity_reports where activity_id = $1', [normalizedActivityId]);
}

export async function upsertActivityReportDraft(activityId, draftData, auth) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const existingDraft = await getActivityReportDraft(normalizedActivityId);
  const actor = normalizeActor(auth);
  const now = new Date().toISOString();
  const normalizedDraft = applyActorMetadata(
    normalizeReportPayload(draftData, true),
    auth,
    {
      draftStartedAt: normalizeString(existingDraft?.draftStartedAt) || now,
      draftStartedByUserId: normalizeString(existingDraft?.draftStartedByUserId) || actor.userId,
      draftStartedByDisplayName: normalizeString(existingDraft?.draftStartedByDisplayName) || actor.displayName,
      draftStartedByEmail: normalizeString(existingDraft?.draftStartedByEmail) || actor.email,
      draftUpdatedAt: now,
      draftUpdatedByUserId: actor.userId,
      draftUpdatedByDisplayName: actor.displayName,
      draftUpdatedByEmail: actor.email,
    },
  );

  const result = await query(
    `
      insert into activity_report_drafts (activity_id, draft_data, created_by_user_id, updated_by_user_id)
      values ($1, $2::jsonb, $3, $4)
      on conflict (activity_id)
      do update set
        draft_data = excluded.draft_data,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
      returning draft_data
    `,
    [normalizedActivityId, JSON.stringify(normalizedDraft), actor.userId || null, actor.userId || null],
  );

  return {
    item: result.rows[0]?.draft_data || normalizedDraft,
    wasCreated: !existingDraft,
  };
}

export async function deleteActivityReportDraft(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  await query('delete from activity_report_drafts where activity_id = $1', [normalizedActivityId]);
}
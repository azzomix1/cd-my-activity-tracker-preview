import { query } from './db.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function normalizeActivityId(activityId) {
  const normalized = String(activityId || '').trim();

  if (!normalized) {
    throw new Error('Activity id is required.');
  }

  return normalized;
}

async function getActivityContext(activityId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const result = await query(
    `
      select
        a.id,
        a.name,
        to_char(a.event_date, 'DD.MM.YYYY') as event_date
      from activities a
      where a.id = $1
      limit 1
    `,
    [normalizedActivityId],
  );

  return result.rows[0] || null;
}

async function listOtherParticipants(activityId, excludedUserId) {
  const normalizedActivityId = normalizeActivityId(activityId);
  const normalizedExcludedUserId = normalizeString(excludedUserId);
  const params = [normalizedActivityId];
  let excludedClause = '';

  if (normalizedExcludedUserId) {
    params.push(normalizedExcludedUserId);
    excludedClause = `and ap.employee_user_id <> $${params.length}`;
  }

  const result = await query(
    `
      select
        ap.employee_user_id,
        coalesce(u.display_name, u.email, ap.employee_user_id) as display_name,
        coalesce(u.email, '') as email
      from activity_participants ap
      left join app_users u on u.id = ap.employee_user_id
      where ap.activity_id = $1
        ${excludedClause}
      order by display_name asc, email asc, ap.employee_user_id asc
    `,
    params,
  );

  return result.rows.map((row) => ({
    userId: normalizeString(row.employee_user_id),
    displayName: normalizeString(row.display_name),
    email: normalizeString(row.email),
  })).filter((participant) => participant.userId);
}

async function insertNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return [];
  }

  const inserted = [];

  for (const notification of notifications) {
    const result = await query(
      `
        insert into activity_notifications (
          recipient_user_id,
          activity_id,
          notification_type,
          notification_data
        )
        values ($1, $2, $3, $4::jsonb)
        returning id, activity_id, notification_type, notification_data, created_at, read_at
      `,
      [
        notification.recipientUserId,
        notification.activityId,
        notification.notificationType,
        JSON.stringify(notification.notificationData || {}),
      ],
    );

    if (result.rows[0]) {
      inserted.push(result.rows[0]);
    }
  }

  return inserted;
}

function buildActivityLabel(activityContext) {
  const activityName = normalizeString(activityContext?.name);
  const eventDate = normalizeString(activityContext?.event_date);

  if (activityName && eventDate) {
    return `мероприятии "${activityName}" от ${eventDate}`;
  }

  if (activityName) {
    return `мероприятии "${activityName}"`;
  }

  if (eventDate) {
    return `мероприятии от ${eventDate}`;
  }

  return 'мероприятии';
}

function mapNotification(row) {
  const notificationData = row.notification_data && typeof row.notification_data === 'object'
    ? row.notification_data
    : {};

  return {
    id: Number(row.id),
    activityId: normalizeString(row.activity_id),
    type: normalizeString(row.notification_type),
    title: normalizeString(notificationData.title),
    message: normalizeString(notificationData.message),
    actorDisplayName: normalizeString(notificationData.actorDisplayName),
    activityName: normalizeString(notificationData.activityName),
    activityDate: normalizeString(notificationData.activityDate),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    readAt: row.read_at ? new Date(row.read_at).toISOString() : '',
    isRead: Boolean(row.read_at),
  };
}

export async function createDraftStartedNotifications(activityId, auth) {
  const actor = normalizeActor(auth);
  if (!actor.userId) {
    return [];
  }

  const [activityContext, recipients] = await Promise.all([
    getActivityContext(activityId),
    listOtherParticipants(activityId, actor.userId),
  ]);

  if (!activityContext || recipients.length === 0) {
    return [];
  }

  const activityLabel = buildActivityLabel(activityContext);
  const notifications = recipients.map((recipient) => ({
    recipientUserId: recipient.userId,
    activityId: normalizeActivityId(activityId),
    notificationType: 'report-draft-started',
    notificationData: {
      title: 'Общий черновик отчета',
      message: `${actor.displayName} начал заполнение общего черновика по ${activityLabel}.`,
      actorDisplayName: actor.displayName,
      activityName: normalizeString(activityContext.name),
      activityDate: normalizeString(activityContext.event_date),
    },
  }));

  const inserted = await insertNotifications(notifications);
  return inserted.map(mapNotification);
}

export async function createReportCompletedNotifications(activityId, auth) {
  const actor = normalizeActor(auth);
  if (!actor.userId) {
    return [];
  }

  const [activityContext, recipients] = await Promise.all([
    getActivityContext(activityId),
    listOtherParticipants(activityId, actor.userId),
  ]);

  if (!activityContext || recipients.length === 0) {
    return [];
  }

  const activityLabel = buildActivityLabel(activityContext);
  const notifications = recipients.map((recipient) => ({
    recipientUserId: recipient.userId,
    activityId: normalizeActivityId(activityId),
    notificationType: 'report-completed',
    notificationData: {
      title: 'Отчет заполнен',
      message: `${actor.displayName} заполнил отчет по ${activityLabel}.`,
      actorDisplayName: actor.displayName,
      activityName: normalizeString(activityContext.name),
      activityDate: normalizeString(activityContext.event_date),
    },
  }));

  const inserted = await insertNotifications(notifications);
  return inserted.map(mapNotification);
}

export async function listNotificationsForUser(userId, { limit = 20 } = {}) {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    return [];
  }

  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20;
  const result = await query(
    `
      select id, activity_id, notification_type, notification_data, created_at, read_at
      from activity_notifications
      where recipient_user_id = $1
      order by created_at desc
      limit $2
    `,
    [normalizedUserId, normalizedLimit],
  );

  return result.rows.map(mapNotification);
}

export async function markAllNotificationsAsRead(userId) {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    return 0;
  }

  const result = await query(
    `
      update activity_notifications
      set read_at = now()
      where recipient_user_id = $1
        and read_at is null
    `,
    [normalizedUserId],
  );

  return Number(result.rowCount || 0);
}

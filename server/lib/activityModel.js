function pad(value) {
  return String(value).padStart(2, '0');
}

export function normalizeVisibility(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'private' || normalized === 'личное' ? 'private' : 'public';
}

export function normalizeEventType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'external' || normalized === 'внешнее' ? 'external' : 'internal';
}

export function normalizeActivityInput(activity = {}) {
  const participantUserIds = Array.isArray(activity.participantUserIds)
    ? activity.participantUserIds.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const participantNames = Array.isArray(activity.participantNames)
    ? activity.participantNames.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    id: String(activity.id ?? '').trim(),
    employeeUserId: String(activity.employeeUserId ?? '').trim(),
    date: String(activity.date ?? '').trim(),
    time: String(activity.time ?? '').trim(),
    name: String(activity.name ?? '').trim(),
    person: String(activity.person ?? '').trim(),
    participantUserIds,
    participantNames,
    objects: String(activity.objects ?? activity.project ?? '').trim(),
    eventType: normalizeEventType(activity.eventType),
    visibility: normalizeVisibility(activity.visibility),
  };
}

export function parseDateString(dateString) {
  const raw = String(dateString || '').trim();
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    throw new Error('Дата должна быть в формате DD.MM.YYYY.');
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseTimeString(timeString) {
  const raw = String(timeString || '').trim();

  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    throw new Error('Время должно быть в формате HH:mm.');
  }

  return `${match[1]}:${match[2]}:00`;
}

export function mapDbRowToActivity(row) {
  const eventDate = row.event_date instanceof Date
    ? `${pad(row.event_date.getDate())}.${pad(row.event_date.getMonth() + 1)}.${row.event_date.getFullYear()}`
    : String(row.event_date || '');

  const eventTime = row.event_time
    ? String(row.event_time).slice(0, 5)
    : '';

  const participantUserIds = Array.isArray(row.participant_user_ids)
    ? row.participant_user_ids.map((item) => String(item || '')).filter(Boolean)
    : [];
  const participantNames = Array.isArray(row.participant_names)
    ? row.participant_names.map((item) => String(item || '')).filter(Boolean)
    : [];

  return {
    id: String(row.id),
    employeeUserId: row.employee_user_id ? String(row.employee_user_id) : '',
    participantUserIds,
    participantNames,
    date: eventDate,
    time: eventTime,
    name: row.name || '',
    person: participantNames.length > 0 ? participantNames.join(', ') : row.person || '',
    objects: row.objects || '',
    eventType: normalizeEventType(row.event_type),
    visibility: normalizeVisibility(row.visibility),
  };
}
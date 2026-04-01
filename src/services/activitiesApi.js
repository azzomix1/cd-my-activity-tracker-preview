const API_URL = import.meta.env.VITE_SHEETS_API_URL?.trim();

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already in expected DD.MM.YYYY format — fast path (used after Apps Script fix)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    return raw;
  }

  // Apps Script sends dates as UTC ISO strings of LOCAL midnight
  // (e.g. 01.04 at midnight UTC+3 → "2026-03-31T21:00:00.000Z").
  // Using local Date methods restores the correct local date.
  // NOTE: this is a temporary fallback; deploy the updated Code.gs to eliminate it.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()}`;
  }

  return raw;
}

function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already HH:mm — fast path (used after Apps Script fix)
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  // HH:mm:ss — strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5);
  }

  // Apps Script sends time serials as UTC ISO strings of LOCAL time
  // (e.g. 10:50 in UTC+3 → "1899-12-30T07:50:00.000Z").
  // Using local getHours() restores the correct local time.
  // NOTE: temporary fallback — deploy the updated Code.gs to eliminate it.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }

  return raw;
}

function normalizeEventType(value) {
  if (!value) {
    return 'internal';
  }

  const normalized = value.toString().trim().toLowerCase();
  return normalized === 'external' || normalized === 'внешнее'
    ? 'external'
    : 'internal';
}

export function normalizeActivity(activity = {}) {
  return {
    id: String(activity.id ?? ''),
    date: normalizeDateValue(activity.date),
    time: normalizeTimeValue(activity.time),
    name: activity.name ?? '',
    person: activity.person ?? '',
    objects: activity.objects ?? activity.project ?? '',
    eventType: normalizeEventType(activity.eventType),
  };
}

export function isSheetsApiConfigured() {
  return Boolean(API_URL);
}

function buildApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw buildApiError('Сервер Google Sheets вернул невалидный JSON.', response.status);
  }
}

async function request(path = '', options = {}) {
  if (!API_URL) {
    throw buildApiError('Не задан адрес API для Google Sheets.', 500);
  }

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    redirect: 'follow',
    ...options,
  });

  const payload = await readJson(response);

  if (!response.ok || payload.success === false) {
    throw buildApiError(
      payload.error || 'Не удалось выполнить запрос к Google Sheets.',
      response.status,
    );
  }

  return payload;
}

function post(action, payload = {}) {
  return request('', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

export async function fetchActivitiesFromApi() {
  const payload = await request('?action=list');
  return Array.isArray(payload.items)
    ? payload.items.map(normalizeActivity)
    : [];
}

export async function createActivityInApi(activity) {
  const payload = await post('create', { activity });
  return normalizeActivity(payload.item ?? activity);
}

export async function updateActivityInApi(activity) {
  const payload = await post('update', { activity });
  return normalizeActivity(payload.item ?? activity);
}

export async function deleteActivityInApi(id) {
  return post('delete', { id: String(id) });
}
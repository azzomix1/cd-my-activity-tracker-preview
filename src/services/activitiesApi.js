const API_URL = import.meta.env.VITE_SHEETS_API_URL?.trim();

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already in expected DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    return raw;
  }

  // ISO date string — extract date part using UTC to avoid day-shift across timezones
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(raw)) {
    const datePart = raw.slice(0, 10);
    const [year, month, day] = datePart.split('-');
    return `${day}.${month}.${year}`;
  }

  // Last-resort parse: use UTC accessors to avoid timezone shift
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getUTCDate())}.${pad(parsed.getUTCMonth() + 1)}.${parsed.getUTCFullYear()}`;
  }

  return raw;
}

function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already HH:mm
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  // HH:mm:ss — strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5);
  }

  // ISO datetime string — extract UTC time to avoid timezone shift
  // Apps Script serialises time cells as UTC ISO strings (e.g. 1899-12-30T04:43:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
    }
  }

  // Last-resort parse: use UTC accessors
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
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
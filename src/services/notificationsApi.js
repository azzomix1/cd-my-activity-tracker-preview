import { getAuthToken } from '../auth/authTokenStorage';

const API_URL = import.meta.env.VITE_API_URL?.trim();

function buildApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeNotification(item = {}) {
  return {
    id: Number(item.id || 0),
    activityId: normalizeString(item.activityId),
    type: normalizeString(item.type),
    title: normalizeString(item.title),
    message: normalizeString(item.message),
    actorDisplayName: normalizeString(item.actorDisplayName),
    activityName: normalizeString(item.activityName),
    activityDate: normalizeString(item.activityDate),
    createdAt: normalizeString(item.createdAt),
    readAt: normalizeString(item.readAt),
    isRead: Boolean(item.isRead),
  };
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw buildApiError('Сервер вернул невалидный JSON.', response.status);
  }
}

async function request(path = '', options = {}) {
  if (!API_URL) {
    throw buildApiError('Не задан адрес backend API.', 500);
  }

  const token = getAuthToken();

  if (!token) {
    throw buildApiError('Требуется авторизация.', 401);
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const payload = await readJson(response);

  if (!response.ok || payload.success === false) {
    throw buildApiError(
      payload.error || 'Не удалось выполнить запрос к backend API.',
      response.status,
    );
  }

  return payload;
}

export async function fetchNotificationsFromApi() {
  const payload = await request('/notifications');
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.map(normalizeNotification);
}

export async function markAllNotificationsReadInApi() {
  const payload = await request('/notifications/read-all', {
    method: 'PUT',
  });

  return Number(payload.updatedCount || 0);
}

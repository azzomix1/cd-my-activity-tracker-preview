import { getAuthToken } from '../auth/authTokenStorage';

const API_URL = import.meta.env.VITE_API_URL?.trim();

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
    throw buildApiError('Сервер вернул невалидный JSON.', response.status);
  }
}

async function request(path, options = {}) {
  if (!API_URL) {
    throw buildApiError('Не задан адрес backend API.', 500);
  }

  const token = getAuthToken();

  if (!token) {
    throw buildApiError('Требуется авторизация.', 401);
  }

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await readJson(response);

  if (!response.ok || payload.success === false) {
    throw buildApiError(payload.error || 'Не удалось выполнить запрос к team API.', response.status);
  }

  return payload;
}

export async function fetchTeamUsers() {
  const payload = await request('/team/users');
  return Array.isArray(payload.users) ? payload.users : [];
}

export async function fetchTeamSummary({ startDate = '', endDate = '', employeeUserId = '' } = {}) {
  const searchParams = new URLSearchParams();

  if (startDate) {
    searchParams.set('startDate', startDate);
  }

  if (endDate) {
    searchParams.set('endDate', endDate);
  }

  if (employeeUserId) {
    searchParams.set('employeeUserId', employeeUserId);
  }

  const query = searchParams.toString();
  const payload = await request(`/team/summary${query ? `?${query}` : ''}`);

  return {
    scope: payload.scope && typeof payload.scope === 'object' ? payload.scope : {},
    overview: payload.overview && typeof payload.overview === 'object' ? payload.overview : {},
    employees: Array.isArray(payload.employees) ? payload.employees : [],
    projects: Array.isArray(payload.projects) ? payload.projects : [],
    reports: Array.isArray(payload.reports) ? payload.reports : [],
  };
}

import { clearAuthToken, getAuthToken, setAuthToken } from '../auth/authTokenStorage';

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

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
  });

  const payload = await readJson(response);

  if (!response.ok || payload.success === false) {
    throw buildApiError(
      payload.error || 'Не удалось выполнить auth-запрос.',
      response.status,
    );
  }

  return payload;
}

function buildSessionRequestHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function loginWithPassword(email, password) {
  const payload = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (payload.token) {
    setAuthToken(payload.token);
  }

  return payload.session;
}

export async function fetchCurrentSession() {
  const token = getAuthToken();

  if (!token) {
    throw buildApiError('Сессия отсутствует.', 401);
  }

  const payload = await request('/auth/session', {
    headers: {
      ...buildSessionRequestHeaders(),
    },
  });

  return payload.session;
}

export async function logoutFromApi() {
  const token = getAuthToken();

  if (!token) {
    clearAuthToken();
    return;
  }

  try {
    await request('/auth/logout', {
      method: 'POST',
      headers: {
        ...buildSessionRequestHeaders(),
      },
    });
  } finally {
    clearAuthToken();
  }
}

export function clearAuthSessionToken() {
  clearAuthToken();
}

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
    throw buildApiError(payload.error || 'Не удалось выполнить запрос к admin API.', response.status);
  }

  return payload;
}

export async function fetchAdminUsers() {
  const payload = await request('/admin/users');
  return Array.isArray(payload.users) ? payload.users : [];
}

export async function fetchHierarchyLinks() {
  const payload = await request('/admin/hierarchy');
  return Array.isArray(payload.links) ? payload.links : [];
}

export async function assignHierarchyLink(managerUserId, employeeUserId) {
  return request('/admin/hierarchy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ managerUserId, employeeUserId }),
  });
}

export async function assignHierarchyLinksBulk(managerUserId, employeeUserIds) {
  return request('/admin/hierarchy/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ managerUserId, employeeUserIds }),
  });
}

export async function deleteHierarchyLink(managerUserId, employeeUserId) {
  return request('/admin/hierarchy', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ managerUserId, employeeUserId }),
  });
}

export async function fetchAdminObjects() {
  const payload = await request('/admin/objects');
  return Array.isArray(payload.objects) ? payload.objects : [];
}

export async function createAdminObject({ name, address, description }) {
  const payload = await request('/admin/objects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, address, description }),
  });
  return payload.object;
}

export async function updateAdminObject(id, { name, address, description }) {
  const payload = await request(`/admin/objects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, address, description }),
  });
  return payload.object;
}

export async function setAdminObjectActive(id, isActive) {
  const payload = await request(`/admin/objects/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  return payload.object;
}

export async function deleteAdminObject(id) {
  return request(`/admin/objects/${id}`, { method: 'DELETE' });
}

export async function fetchAdminFeedback(limit = 100) {
  const payload = await request(`/admin/feedback?limit=${encodeURIComponent(String(limit))}`);
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function setFeedbackTags(id, tags) {
  const payload = await request(`/admin/feedback/${encodeURIComponent(String(id))}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });
  return payload.item;
}

export async function deleteFeedbackMessage(id) {
  await request(`/admin/feedback/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

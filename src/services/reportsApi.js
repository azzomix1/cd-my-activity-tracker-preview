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

function normalizeProjects(value, preserveEmpty) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedProjects = value.map((project) => normalizeString(project));
  return preserveEmpty ? normalizedProjects : normalizedProjects.filter(Boolean);
}

export function normalizeReportData(reportData = {}) {
  return {
    date: normalizeString(reportData.date),
    time: normalizeString(reportData.time),
    employeeName: normalizeString(reportData.employeeName),
    meetingContent: normalizeString(reportData.meetingContent),
    meetingFormat: normalizeString(reportData.meetingFormat),
    projects: normalizeProjects(reportData.projects, false),
    notificationsCount: normalizeString(reportData.notificationsCount),
    telegramSubscriptionsCount: normalizeString(reportData.telegramSubscriptionsCount),
    comment: normalizeString(reportData.comment),
    updatedAt: normalizeString(reportData.updatedAt),
  };
}

export function normalizeReportDraftData(draftData = {}) {
  return {
    date: normalizeString(draftData.date),
    time: normalizeString(draftData.time),
    employeeName: normalizeString(draftData.employeeName),
    meetingContent: normalizeString(draftData.meetingContent),
    meetingFormat: normalizeString(draftData.meetingFormat),
    projects: normalizeProjects(draftData.projects, true),
    notificationsCount: normalizeString(draftData.notificationsCount),
    telegramSubscriptionsCount: normalizeString(draftData.telegramSubscriptionsCount),
    comment: normalizeString(draftData.comment),
    updatedAt: normalizeString(draftData.updatedAt),
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

function normalizeDictionary(input, itemNormalizer) {
  if (!input || typeof input !== 'object') {
    return {};
  }

  return Object.entries(input).reduce((result, [activityId, payload]) => {
    result[String(activityId)] = itemNormalizer(payload);
    return result;
  }, {});
}

export async function fetchReportsSnapshotFromApi() {
  const payload = await request('/reports');

  return {
    reportsByActivityId: normalizeDictionary(payload.reportsByActivityId, normalizeReportData),
    draftsByActivityId: normalizeDictionary(payload.draftsByActivityId, normalizeReportDraftData),
  };
}

export async function saveReportToApi(activityId, reportData) {
  const payload = await request(`/reports/${encodeURIComponent(String(activityId))}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ report: reportData }),
  });

  return normalizeReportData(payload.item || reportData);
}

export async function deleteReportFromApi(activityId) {
  return request(`/reports/${encodeURIComponent(String(activityId))}`, {
    method: 'DELETE',
  });
}

export async function saveReportDraftToApi(activityId, draftData) {
  const payload = await request(`/report-drafts/${encodeURIComponent(String(activityId))}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ draft: draftData }),
  });

  return normalizeReportDraftData(payload.item || draftData);
}

export async function deleteReportDraftFromApi(activityId) {
  return request(`/report-drafts/${encodeURIComponent(String(activityId))}`, {
    method: 'DELETE',
  });
}
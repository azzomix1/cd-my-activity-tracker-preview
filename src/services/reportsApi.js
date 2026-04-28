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

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item).trim()).filter(Boolean);
  }

  const normalized = normalizeString(value).trim();

  if (!normalized) {
    return [];
  }

  return normalized.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeProjects(value, preserveEmpty) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedProjects = value.map((project) => normalizeString(project));
  return preserveEmpty ? normalizedProjects : normalizedProjects.filter(Boolean);
}

export function normalizeReportData(reportData = {}) {
  const employeeNames = normalizeStringArray(reportData.employeeNames || reportData.employeeName);

  return {
    date: normalizeString(reportData.date),
    time: normalizeString(reportData.time),
    employeeName: normalizeString(reportData.employeeName) || employeeNames.join(', '),
    employeeNames,
    meetingContent: normalizeString(reportData.meetingContent),
    meetingFormat: normalizeString(reportData.meetingFormat),
    projects: normalizeProjects(reportData.projects, false),
    notificationsCount: normalizeString(reportData.notificationsCount),
    telegramSubscriptionsCount: normalizeString(reportData.telegramSubscriptionsCount),
    comment: normalizeString(reportData.comment),
    updatedAt: normalizeString(reportData.updatedAt),
    createdByUserId: normalizeString(reportData.createdByUserId),
    createdByDisplayName: normalizeString(reportData.createdByDisplayName),
    createdByEmail: normalizeString(reportData.createdByEmail),
    lastUpdatedByUserId: normalizeString(reportData.lastUpdatedByUserId),
    lastUpdatedByDisplayName: normalizeString(reportData.lastUpdatedByDisplayName),
    lastUpdatedByEmail: normalizeString(reportData.lastUpdatedByEmail),
    completedAt: normalizeString(reportData.completedAt),
    completedByUserId: normalizeString(reportData.completedByUserId),
    completedByDisplayName: normalizeString(reportData.completedByDisplayName),
    completedByEmail: normalizeString(reportData.completedByEmail),
  };
}

export function normalizeReportDraftData(draftData = {}) {
  const employeeNames = normalizeStringArray(draftData.employeeNames || draftData.employeeName);

  return {
    date: normalizeString(draftData.date),
    time: normalizeString(draftData.time),
    employeeName: normalizeString(draftData.employeeName) || employeeNames.join(', '),
    employeeNames,
    meetingContent: normalizeString(draftData.meetingContent),
    meetingFormat: normalizeString(draftData.meetingFormat),
    projects: normalizeProjects(draftData.projects, true),
    notificationsCount: normalizeString(draftData.notificationsCount),
    telegramSubscriptionsCount: normalizeString(draftData.telegramSubscriptionsCount),
    comment: normalizeString(draftData.comment),
    updatedAt: normalizeString(draftData.updatedAt),
    draftStartedAt: normalizeString(draftData.draftStartedAt),
    draftStartedByUserId: normalizeString(draftData.draftStartedByUserId),
    draftStartedByDisplayName: normalizeString(draftData.draftStartedByDisplayName),
    draftStartedByEmail: normalizeString(draftData.draftStartedByEmail),
    draftUpdatedAt: normalizeString(draftData.draftUpdatedAt),
    draftUpdatedByUserId: normalizeString(draftData.draftUpdatedByUserId),
    draftUpdatedByDisplayName: normalizeString(draftData.draftUpdatedByDisplayName),
    draftUpdatedByEmail: normalizeString(draftData.draftUpdatedByEmail),
    lastUpdatedByUserId: normalizeString(draftData.lastUpdatedByUserId),
    lastUpdatedByDisplayName: normalizeString(draftData.lastUpdatedByDisplayName),
    lastUpdatedByEmail: normalizeString(draftData.lastUpdatedByEmail),
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

export function buildReportOwnerKey(activityId, employeeUserId) {
  void employeeUserId;
  return String(activityId || '').trim();
}
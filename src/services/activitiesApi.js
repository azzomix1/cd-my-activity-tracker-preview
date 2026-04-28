import { getAuthToken } from '../auth/authTokenStorage';

const API_URL = import.meta.env.VITE_API_URL?.trim();

/**
 * @typedef {Object} Activity
 * @property {string} id Уникальный идентификатор активности.
 * @property {string} employeeUserId Идентификатор сотрудника из таблицы пользователей.
 * @property {string[]} participantUserIds Идентификаторы сотрудников-участников.
 * @property {string[]} participantNames Отображаемые имена участников.
 * @property {string} date Дата в формате `DD.MM.YYYY`.
 * @property {string} time Время в формате `HH:mm`.
 * @property {string} name Название активности.
 * @property {string} person Участник/ответственный.
 * @property {string} objects Объект/площадка.
 * @property {'internal'|'external'} eventType Тип события.
 * @property {'public'|'private'} visibility Видимость мероприятия.
 */

/**
 * Дополняет однозначные значения ведущим нулем.
 * @param {number|string} value Исходное значение.
 * @returns {string} Двузначная строка.
 */
function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Нормализует входную дату к формату `DD.MM.YYYY`.
 * @param {unknown} value Входное значение даты из API/формы.
 * @returns {string} Нормализованная дата либо исходная строка.
 */
function normalizeDateValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already in expected DD.MM.YYYY format.
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    return raw;
  }

  // Databases and forms may still provide ISO-like date strings.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()}`;
  }

  return raw;
}

/**
 * Нормализует входное время к формату `HH:mm`.
 * @param {unknown} value Входное значение времени из API/формы.
 * @returns {string} Нормализованное время либо исходная строка.
 */
function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  // Already HH:mm.
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  // HH:mm:ss — strip seconds
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5);
  }

  // API payloads may still provide time values in ISO-like form.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }

  return raw;
}

/**
 * Нормализует видимость мероприятия к строгому набору `'public' | 'private'`.
 * @param {unknown} value Входное значение видимости.
 * @returns {'public'|'private'} Нормализованная видимость.
 */
function normalizeVisibility(value) {
  if (!value) {
    return 'public';
  }

  const normalized = value.toString().trim().toLowerCase();
  return normalized === 'private' || normalized === 'личное'
    ? 'private'
    : 'public';
}

/**
 * Приводит тип события к строгому набору `'internal' | 'external'`.
 * @param {unknown} value Входной тип события.
 * @returns {'internal'|'external'} Нормализованный тип.
 */
function normalizeEventType(value) {
  if (!value) {
    return 'internal';
  }

  const normalized = value.toString().trim().toLowerCase();
  return normalized === 'external' || normalized === 'внешнее'
    ? 'external'
    : 'internal';
}

/**
 * Приводит произвольный объект активности к стабильной структуре `Activity`.
 * @param {Partial<Activity>} [activity={}] Частично заполненная активность.
 * @returns {Activity} Нормализованная активность.
 */
export function normalizeActivity(activity = {}) {
  const participantUserIds = Array.isArray(activity.participantUserIds)
    ? activity.participantUserIds.map((item) => String(item || '')).filter(Boolean)
    : [];
  const participantNames = Array.isArray(activity.participantNames)
    ? activity.participantNames.map((item) => String(item || '')).filter(Boolean)
    : [];

  return {
    id: String(activity.id ?? ''),
    employeeUserId: String(activity.employeeUserId ?? ''),
    participantUserIds,
    participantNames,
    date: normalizeDateValue(activity.date),
    time: normalizeTimeValue(activity.time),
    name: activity.name ?? '',
    person: activity.person ?? participantNames.join(', '),
    objects: activity.objects ?? activity.project ?? '',
    eventType: normalizeEventType(activity.eventType),
    visibility: normalizeVisibility(activity.visibility),
  };
}

/**
 * Проверяет, задан ли URL backend API в переменных окружения.
 * @returns {boolean} `true`, если API URL доступен.
 */
export function isActivitiesApiConfigured() {
  return Boolean(API_URL);
}

/**
 * Создает объект ошибки с HTTP-статусом.
 * @param {string} message Текст ошибки.
 * @param {number} status HTTP-статус.
 * @returns {Error & {status: number}} Ошибка с дополнительным полем `status`.
 */
function buildApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Безопасно читает JSON из ответа сервера.
 * @param {Response} response Fetch response.
 * @returns {Promise<any>} Распарсенный JSON-объект.
 */
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

/**
 * Выполняет HTTP-запрос к backend API и валидирует успешный ответ.
 * @param {string} [path=''] Суффикс URL, включая query string.
 * @param {RequestInit} [options={}] Опции запроса fetch.
 * @returns {Promise<any>} Полезная нагрузка ответа API.
 */
async function request(path = '', options = {}) {
  const { requiresAuth = true, ...fetchOptions } = options;

  if (!API_URL) {
    throw buildApiError('Не задан адрес backend API.', 500);
  }

  const headers = {
    ...(fetchOptions.headers || {}),
  };

  if (requiresAuth) {
    const token = getAuthToken();

    if (!token) {
      throw buildApiError('Требуется авторизация.', 401);
    }

    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...fetchOptions,
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

/**
 * Загружает список активностей из backend API.
 * @returns {Promise<Activity[]>} Нормализованный массив активностей.
 */
export async function fetchActivitiesFromApi() {
  const payload = await request('/activities');
  return Array.isArray(payload.items)
    ? payload.items.map(normalizeActivity)
    : [];
}

/**
 * Загружает только публичные активности без авторизации.
 * @returns {Promise<Activity[]>} Нормализованный массив публичных активностей.
 */
export async function fetchPublicActivitiesFromApi() {
  const payload = await request('/public/activities', { requiresAuth: false });

  return Array.isArray(payload.items)
    ? payload.items.map(normalizeActivity)
    : [];
}

/**
 * Создает активность через API.
 * @param {Activity} activity Данные новой активности.
 * @returns {Promise<Activity>} Созданная и нормализованная активность.
 */
export async function createActivityInApi(activity) {
  const payload = await request('/activities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activity }),
  });

  return normalizeActivity(payload.item ?? activity);
}

/**
 * Обновляет активность через API.
 * @param {Activity} activity Обновленные данные активности.
 * @returns {Promise<Activity>} Обновленная и нормализованная активность.
 */
export async function updateActivityInApi(activity) {
  const payload = await request(`/activities/${encodeURIComponent(String(activity.id))}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activity }),
  });

  return normalizeActivity(payload.item ?? activity);
}

/**
 * Удаляет активность по ID через API.
 * @param {string|number} id Идентификатор активности.
 * @returns {Promise<any>} Ответ API по операции удаления.
 */
export async function deleteActivityInApi(id) {
  return request(`/activities/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });
}
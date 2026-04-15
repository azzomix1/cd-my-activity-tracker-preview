const API_URL = import.meta.env.VITE_SHEETS_API_URL?.trim();

/**
 * @typedef {Object} Activity
 * @property {string} id Уникальный идентификатор активности.
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
  return {
    id: String(activity.id ?? ''),
    date: normalizeDateValue(activity.date),
    time: normalizeTimeValue(activity.time),
    name: activity.name ?? '',
    person: activity.person ?? '',
    objects: activity.objects ?? activity.project ?? '',
    eventType: normalizeEventType(activity.eventType),
    visibility: normalizeVisibility(activity.visibility),
  };
}

/**
 * Проверяет, задан ли URL Google Sheets API в переменных окружения.
 * @returns {boolean} `true`, если API URL доступен.
 */
export function isSheetsApiConfigured() {
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
    throw buildApiError('Сервер Google Sheets вернул невалидный JSON.', response.status);
  }
}

/**
 * Выполняет HTTP-запрос к Google Sheets API и валидирует успешный ответ.
 * @param {string} [path=''] Суффикс URL, включая query string.
 * @param {RequestInit} [options={}] Опции запроса fetch.
 * @returns {Promise<any>} Полезная нагрузка ответа API.
 */
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

/**
 * Отправляет POST-действие в API с единым контрактом payload.
 * @param {'create'|'update'|'delete'} action Имя действия API.
 * @param {Object} [payload={}] Данные действия.
 * @returns {Promise<any>} Ответ API.
 */
function post(action, payload = {}) {
  return request('', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

/**
 * Загружает список активностей из Google Sheets API.
 * @returns {Promise<Activity[]>} Нормализованный массив активностей.
 */
export async function fetchActivitiesFromApi() {
  const payload = await request('?action=list');
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
  const payload = await post('create', { activity });
  return normalizeActivity(payload.item ?? activity);
}

/**
 * Обновляет активность через API.
 * @param {Activity} activity Обновленные данные активности.
 * @returns {Promise<Activity>} Обновленная и нормализованная активность.
 */
export async function updateActivityInApi(activity) {
  const payload = await post('update', { activity });
  return normalizeActivity(payload.item ?? activity);
}

/**
 * Удаляет активность по ID через API.
 * @param {string|number} id Идентификатор активности.
 * @returns {Promise<any>} Ответ API по операции удаления.
 */
export async function deleteActivityInApi(id) {
  return post('delete', { id: String(id) });
}
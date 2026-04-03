/**
 * Названия месяцев для отображения в календаре.
 * Индексы соответствуют значениям `Date.getMonth()`.
 * @type {string[]}
 */
export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/**
 * Короткие названия дней недели в формате Пн..Вс.
 * @type {string[]}
 */
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * Вычисляет служебные данные календаря для конкретного месяца.
 *
 * @param {number} year Год, например `2026`.
 * @param {number} month Номер месяца от `0` (январь) до `11` (декабрь).
 * @returns {{year: number, month: number, daysInMonth: number, startDayOfWeek: number}}
 * Объект с количеством дней и стартовым днем недели в формате Пн=0..Вс=6.
 */
export function getCalendarData(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Формат Пн=0, Вс=6
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  
  return {
    year,
    month,
    daysInMonth,
    startDayOfWeek
  };
}

/**
 * Форматирует значение даты в строку `DD.MM.YYYY`.
 *
 * @param {Date|string|number} date Входное значение даты, совместимое с конструктором `Date`.
 * @returns {string} Дата в формате `DD.MM.YYYY`.
 */
export function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Парсит дату из строки `DD.MM.YYYY`.
 *
 * @param {string} dateString Строка даты в формате `DD.MM.YYYY`.
 * @returns {Date|null} Экземпляр `Date` или `null`, если строка пустая/некорректная.
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  
  const parts = dateString.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  
  return null;
}

/**
 * Преобразует дату в формат поля `input[type="date"]` (`YYYY-MM-DD`).
 *
 * @param {Date|string|number} date Входное значение даты.
 * @returns {string} Дата в формате `YYYY-MM-DD`.
 */
export function toInputDateFormat(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Преобразует строку из формата `YYYY-MM-DD` в `DD.MM.YYYY`.
 *
 * @param {string} inputValue Значение из поля `input[type="date"]`.
 * @returns {string} Дата в формате `DD.MM.YYYY`.
 */
export function fromInputDateFormat(inputValue) {
  const parts = inputValue.split('-');
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Проверяет, совпадает ли переданная дата с текущим днем пользователя.
 *
 * @param {number} year Год.
 * @param {number} month Месяц в формате `Date.getMonth()` (`0..11`).
 * @param {number} day День месяца (`1..31`).
 * @returns {boolean} `true`, если дата совпадает с сегодняшней.
 */
export function isToday(year, month, day) {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}
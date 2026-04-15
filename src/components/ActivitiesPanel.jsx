import ActivityItem from './ActivityItem';
import { MONTHS } from '../utils/dateUtils';

/**
 * Возвращает `true`, если заданная дата строго в прошлом (не сегодня).
 * @param {number} year
 * @param {number} month 0-based
 * @param {number} day
 * @returns {boolean}
 */
function isPastDay(year, month, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(year, month, day);
  return date < today;
}

/**
 * Панель активностей выбранного дня.
 *
 * @param {Object} props Свойства компонента.
 * @param {Date|null} props.selectedDate Выбранная дата или `null`.
 * @param {import('../services/activitiesApi').Activity[]} props.activities Список активностей на выбранную дату.
 * @param {{total: number, internalCount: number, externalCount: number, peopleCount: number, objectCount: number, nextActivity: import('../services/activitiesApi').Activity | null} | null} props.summary Сводка по выбранному дню.
 * @param {'month' | 'week' | 'list'} props.viewMode Активный режим календаря.
 * @param {boolean} props.hasActiveFilters Есть ли активные фильтры или поисковый запрос.
 * @param {boolean} [props.readOnly=false] Разрешено ли только чтение без CRUD-действий.
 * @param {() => void} props.onAddClick Обработчик добавления активности.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} props.onEdit Обработчик редактирования.
 * @param {(id: string) => void} props.onDelete Обработчик удаления.
 * @returns {JSX.Element} Блок с заголовком даты и списком активностей.
 */
function ActivitiesPanel({ 
  selectedDate,
  activities, 
  summary,
  viewMode,
  hasActiveFilters,
  readOnly = false,
  onAddClick,
  onEdit,
  onDelete 
}) {
  const dateText = selectedDate
    ? `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].toLowerCase()} ${selectedDate.getFullYear()}`
    : 'Выберите дату';

  const isEditable = selectedDate
    ? !isPastDay(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    : false;

  const emptyMessage = hasActiveFilters
    ? 'По текущим фильтрам на эту дату активностей нет'
    : 'На эту дату нет активностей';

  const panelTitle = viewMode === 'month'
    ? 'Программа дня'
    : 'Карточка выбранного дня';

  const noDateMessage = viewMode === 'month'
    ? 'Выберите дату в календаре, чтобы увидеть программу дня'
    : 'Выберите день в текущем представлении, чтобы открыть карточку дня';

  const dayTempo = !summary || summary.total === 0
    ? 'Свободный день без публичных встреч'
    : summary.total >= 5
      ? 'Насыщенный день с плотной публичной программой'
      : summary.total >= 3
        ? 'Сбалансированный день с несколькими встречами'
        : 'Легкий день с точечными активностями';

  return (
    <div className="activities-section">
      <div className="header">
        <div className="activities-header">
          <div>
            <h3>{panelTitle}</h3>
            <div className="selected-date">{dateText}</div>
          </div>
          {selectedDate && isEditable && !readOnly && (
            <button className="btn btn-add" onClick={onAddClick}>
              + Добавить
            </button>
          )}
        </div>
      </div>

      {selectedDate && summary && (
        <div className="activities-day-card">
          <div className="activities-day-card__hero">
            <div>
              <div className="activities-day-card__eyebrow">Публичный день</div>
              <div className="activities-day-card__headline">
                {summary.total > 0 ? `${summary.total} запланировано` : 'День пока свободен'}
              </div>
              <div className="activities-day-card__lead">{dayTempo}</div>
            </div>
          </div>
          <div className="activities-day-card__metrics">
            <div className="activities-day-card__metric">
              <span className="activities-day-card__metric-label">Внутренние</span>
              <span className="activities-day-card__metric-value">{summary.internalCount}</span>
            </div>
            <div className="activities-day-card__metric">
              <span className="activities-day-card__metric-label">Внешние</span>
              <span className="activities-day-card__metric-value">{summary.externalCount}</span>
            </div>
            <div className="activities-day-card__metric">
              <span className="activities-day-card__metric-label">Сотрудники</span>
              <span className="activities-day-card__metric-value">{summary.peopleCount}</span>
            </div>
            <div className="activities-day-card__metric">
              <span className="activities-day-card__metric-label">Объекты</span>
              <span className="activities-day-card__metric-value">{summary.objectCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="activities-list">
        {!selectedDate ? (
          <div className="no-activities">
            {noDateMessage}
          </div>
        ) : activities.length === 0 ? (
          <div className="no-activities">
            {emptyMessage}
          </div>
        ) : (
          activities.map(activity => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onEdit={onEdit}
              onDelete={onDelete}
              editable={isEditable && !readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ActivitiesPanel;
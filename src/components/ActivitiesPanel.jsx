import ActivityItem from './ActivityItem';
import { MONTHS } from '../utils/dateUtils';

/**
 * Панель активностей выбранного дня.
 *
 * @param {Object} props Свойства компонента.
 * @param {number|null} props.selectedDay Выбранный день месяца или `null`.
 * @param {number} props.currentMonth Текущий месяц (`0..11`).
 * @param {number} props.currentYear Текущий год.
 * @param {import('../services/activitiesApi').Activity[]} props.activities Список активностей на выбранную дату.
 * @param {() => void} props.onAddClick Обработчик добавления активности.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} props.onEdit Обработчик редактирования.
 * @param {(id: string) => void} props.onDelete Обработчик удаления.
 * @returns {JSX.Element} Блок с заголовком даты и списком активностей.
 */
function ActivitiesPanel({ 
  selectedDay, 
  currentMonth, 
  currentYear,
  activities, 
  onAddClick,
  onEdit,
  onDelete 
}) {
  const dateText = selectedDay 
    ? `${selectedDay} ${MONTHS[currentMonth].toLowerCase()} ${currentYear}`
    : 'Выберите дату';

  return (
    <div className="activities-section">
      <div className="header">
        <div className="activities-header">
          <div>
            <h3>Активности</h3>
            <div className="selected-date">{dateText}</div>
          </div>
          {selectedDay && (
            <button className="btn btn-add" onClick={onAddClick}>
              + Добавить
            </button>
          )}
        </div>
      </div>

      <div className="activities-list">
        {!selectedDay ? (
          <div className="no-activities">
            Выберите дату для просмотра активностей
          </div>
        ) : activities.length === 0 ? (
          <div className="no-activities">
            На эту дату нет активностей
          </div>
        ) : (
          activities.map(activity => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ActivitiesPanel;
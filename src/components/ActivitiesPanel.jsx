import ActivityItem from './ActivityItem';
import { MONTHS } from '../utils/dateUtils';

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
import { Pencil, X } from 'lucide-react';

/**
 * Отрисовывает одну карточку активности.
 *
 * @param {Object} props Свойства компонента.
 * @param {import('../services/activitiesApi').Activity} props.activity Данные активности.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} props.onEdit Обработчик редактирования.
 * @param {(id: string) => void} props.onDelete Обработчик удаления.
 * @param {boolean} [props.editable=true] Разрешать ли редактирование и удаление.
 * @returns {JSX.Element} Карточка активности с действиями.
 */
function ActivityItem({ activity, onEdit, onDelete, editable = true }) {
  const eventTypeClass = activity.eventType === 'external' ? 'activity-item--external' : 'activity-item--internal';
  
  return (
    <div className={`activity-item ${eventTypeClass}`}>
      <div className="activity-header">
        <span className="activity-time">
          {activity.time || 'Без времени'}
        </span>
        {editable && (
          <div className="activity-actions">
            <button 
              className="btn btn-edit" 
              onClick={() => onEdit(activity)}
              title="Редактировать"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button 
              className="btn btn-delete" 
              onClick={() => onDelete(activity.id)}
              title="Удалить"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      
      {activity.person && (
        <div className="activity-type">{activity.person}</div>
      )}
      
      {activity.name && (
        <div className="activity-name">{activity.name}</div>
      )}
      
      {activity.objects && (
        <div className="activity-project">Объект: {activity.objects}</div>
      )}
    </div>
  );
}

export default ActivityItem;
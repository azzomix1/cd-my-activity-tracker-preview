function ActivityItem({ activity, onEdit, onDelete }) {
  const eventTypeClass = activity.eventType === 'external' ? 'activity-item--external' : 'activity-item--internal';
  
  return (
    <div className={`activity-item ${eventTypeClass}`}>
      <div className="activity-header">
        <span className="activity-time">
          {activity.time || 'Без времени'}
        </span>
        <div className="activity-actions">
          <button 
            className="btn btn-edit" 
            onClick={() => onEdit(activity)}
            title="Редактировать"
          >
            ⋯
          </button>
          <button 
            className="btn btn-delete" 
            onClick={() => onDelete(activity.id)}
            title="Удалить"
          >
            ✕
          </button>
        </div>
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
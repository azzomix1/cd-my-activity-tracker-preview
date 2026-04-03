import { useState } from 'react';
import { toInputDateFormat, fromInputDateFormat } from '../utils/dateUtils';

/**
 * Формирует начальные значения полей модального окна.
 *
 * @param {import('../services/activitiesApi').Activity|null} activity Редактируемая активность или `null`.
 * @param {Date|null} selectedDate Выбранная дата календаря для режима создания.
 * @returns {{date: string, time: string, name: string, person: string, objects: string, eventType: 'internal'|'external'}}
 * Начальное состояние формы.
 */
function createInitialFormData(activity, selectedDate) {
  if (activity) {
    const dateParts = activity.date.split('.');
    const dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    return {
      date: dateStr,
      time: activity.time || '',
      name: activity.name || '',
      person: activity.person || '',
      objects: activity.objects || activity.project || '',
      eventType: activity.eventType || 'internal'
    };
  }

  return {
    date: selectedDate ? toInputDateFormat(selectedDate) : '',
    time: '',
    name: '',
    person: '',
    objects: '',
    eventType: 'internal'
  };
}

/**
 * Модальное окно добавления/редактирования активности.
 *
 * @param {Object} props Свойства компонента.
 * @param {boolean} props.isOpen Флаг открытия окна.
 * @param {() => void} props.onClose Обработчик закрытия окна.
 * @param {(activityData: import('../services/activitiesApi').Activity, isEditMode: boolean) => Promise<void>} props.onSave Обработчик сохранения.
 * @param {import('../services/activitiesApi').Activity|null} props.activity Активность для редактирования или `null`.
 * @param {Date|null} props.selectedDate Выбранная дата календаря.
 * @param {{names: string[], persons: string[], objects: string[]}} props.suggestions Данные автодополнения.
 * @param {boolean} props.isSubmitting Флаг отправки формы.
 * @returns {JSX.Element|null} JSX модального окна либо `null`, если окно закрыто.
 */
function ActivityModal({ 
  isOpen, 
  onClose, 
  onSave, 
  activity,
  selectedDate,
  suggestions,
  isSubmitting,
}) {
  const [formData, setFormData] = useState(() => createInitialFormData(activity, selectedDate));

  const isEditMode = !!activity;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const activityData = {
      ...(activity && { id: activity.id }),
      date: fromInputDateFormat(formData.date),
      time: formData.time,
      name: formData.name,
      person: formData.person,
      objects: formData.objects,
      eventType: formData.eventType
    };

    await onSave(activityData, isEditMode);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal">
        <h3>{isEditMode ? 'Редактировать активность' : 'Добавить активность'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="date">Дата *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="time">Время</label>
            <input
              type="time"
              id="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Название активности *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Введите название"
              list="namesList"
              disabled={isSubmitting}
              required
            />
            <datalist id="namesList">
              {suggestions.names.map((item, i) => (
                <option key={i} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="person">Участник</label>
            <input
              type="text"
              id="person"
              name="person"
              value={formData.person}
              onChange={handleChange}
              placeholder="ФИО участника"
              list="personsList"
              disabled={isSubmitting}
            />
            <datalist id="personsList">
              {suggestions.persons.map((item, i) => (
                <option key={i} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="objects">Объекты</label>
            <input
              type="text"
              id="objects"
              name="objects"
              value={formData.objects}
              onChange={handleChange}
              placeholder="Название объекта"
              list="objectsList"
              disabled={isSubmitting}
            />
            <datalist id="objectsList">
              {suggestions.objects.map((item, i) => (
                <option key={i} value={item} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="eventType">Тип мероприятия *</label>
            <select
              id="eventType"
              name="eventType"
              value={formData.eventType}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            >
              <option value="internal">Внутреннее</option>
              <option value="external">Внешнее</option>
            </select>
          </div>

          <div className="modal-buttons">
            <button type="button" className="btn btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-save" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ActivityModal;
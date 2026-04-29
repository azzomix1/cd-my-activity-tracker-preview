import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toInputDateFormat, fromInputDateFormat } from '../utils/dateUtils';

function splitObjects(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Формирует начальные значения полей модального окна.
 *
 * @param {import('../services/activitiesApi').Activity|null} activity Редактируемая активность или `null`.
 * @param {Date|null} selectedDate Выбранная дата календаря для режима создания.
 * @returns {{date: string, time: string, name: string, participantUserIds: string[], objectItems: string[], eventType: 'internal'|'external', visibility: 'public'|'private'}}
 * Начальное состояние формы.
 */
function createInitialFormData(activity, selectedDate) {
  if (activity) {
    const dateParts = activity.date.split('.');
    const dateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    const initialObjectItems = splitObjects(activity.objects || activity.project || '');

    return {
      date: dateStr,
      time: activity.time || '',
      name: activity.name || '',
      participantUserIds: Array.isArray(activity.participantUserIds) && activity.participantUserIds.length > 0
        ? activity.participantUserIds
        : (activity.employeeUserId ? [activity.employeeUserId] : ['']),
      objectItems: initialObjectItems.length > 0 ? initialObjectItems : [''],
      eventType: activity.eventType || 'internal',
      visibility: activity.visibility || 'public',
    };
  }

  return {
    date: selectedDate ? toInputDateFormat(selectedDate) : '',
    time: '',
    name: '',
    participantUserIds: [''],
    objectItems: [''],
    eventType: 'internal',
    visibility: 'public',
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
 * @param {{id: string, displayName?: string, email?: string}[]} [props.assignableUsers=[]] Сотрудники, которых можно назначить в мероприятие.
 * @param {boolean} [props.allowPrivateVisibility=true] Доступна ли личная видимость для текущей роли.
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
  assignableUsers = [],
  allowPrivateVisibility = true,
  isSubmitting,
  submitError,
}) {
  const [formData, setFormData] = useState(() => createInitialFormData(activity, selectedDate));
  const [validationError, setValidationError] = useState('');
  const firstFieldRef = useRef(null);

  const isEditMode = !!activity;

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValidationError('');
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleObjectChange = (index, value) => {
    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      objectItems: prev.objectItems.map((item, itemIndex) => (
        itemIndex === index ? value : item
      )),
    }));
  };

  const handleParticipantChange = (index, value) => {
    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      participantUserIds: prev.participantUserIds.map((item, itemIndex) => (
        itemIndex === index ? value : item
      )),
    }));
  };

  const handleAddParticipant = () => {
    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      participantUserIds: [...prev.participantUserIds, ''],
    }));
  };

  const handleRemoveParticipant = (index) => {
    setValidationError('');
    setFormData((prev) => {
      const nextParticipantUserIds = prev.participantUserIds.filter((_, itemIndex) => itemIndex !== index);

      return {
        ...prev,
        participantUserIds: nextParticipantUserIds.length > 0 ? nextParticipantUserIds : [''],
      };
    });
  };

  const handleAddObject = () => {
    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      objectItems: [...prev.objectItems, ''],
    }));
  };

  const handleRemoveObject = (index) => {
    setValidationError('');
    setFormData((prev) => {
      const nextObjectItems = prev.objectItems.filter((_, itemIndex) => itemIndex !== index);

      return {
        ...prev,
        objectItems: nextObjectItems.length > 0 ? nextObjectItems : [''],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setValidationError('Название активности не может быть пустым.');
      firstFieldRef.current?.focus();
      return;
    }

    const participantUserIds = formData.participantUserIds.map((item) => item.trim()).filter(Boolean);

    if (participantUserIds.length === 0) {
      setValidationError('Нужно выбрать хотя бы одного сотрудника для мероприятия.');
      return;
    }

    const participantNames = participantUserIds
      .map((participantUserId) => assignableUsers.find((item) => item.id === participantUserId))
      .filter(Boolean)
      .map((item) => item.displayName || item.email || item.id);

    const activityData = {
      ...(activity && { id: activity.id }),
      date: fromInputDateFormat(formData.date),
      time: formData.time,
      name: trimmedName,
      employeeUserId: participantUserIds[0] || '',
      participantUserIds,
      participantNames,
      person: participantNames.join(', '),
      objects: formData.objectItems.map((item) => item.trim()).filter(Boolean).join(', '),
      eventType: formData.eventType,
      visibility: allowPrivateVisibility ? formData.visibility : 'public',
    };

    await onSave(activityData, isEditMode);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const displayError = validationError || submitError || '';

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal">
        <h3>{isEditMode ? 'Редактировать активность' : 'Добавить активность'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="date">Дата *</label>
            <input
              ref={firstFieldRef}
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
            <div className="report-modal__projects-header">
              <label>Сотрудники</label>
              <button
                type="button"
                className="btn btn-edit report-modal__project-add"
                onClick={handleAddParticipant}
                disabled={isSubmitting}
              >
                <Plus size={14} aria-hidden="true" />
                Добавить сотрудника
              </button>
            </div>

            <div className="report-modal__projects-list">
              {formData.participantUserIds.map((participantUserId, index) => (
                <div key={`participant-${index}`} className="report-modal__project-row">
                  <select
                    value={participantUserId}
                    onChange={(event) => handleParticipantChange(index, event.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Выберите сотрудника</option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName || user.email || user.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-cancel report-modal__project-remove"
                    onClick={() => handleRemoveParticipant(index)}
                    disabled={isSubmitting || formData.participantUserIds.length <= 1}
                    aria-label={`Удалить сотрудника ${index + 1}`}
                  >
                    <X size={14} aria-hidden="true" />
                    Убрать
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="report-modal__projects-header">
              <label>Объекты</label>
              <button
                type="button"
                className="btn btn-edit report-modal__project-add"
                onClick={handleAddObject}
                disabled={isSubmitting}
              >
                <Plus size={14} aria-hidden="true" />
                Добавить объект
              </button>
            </div>

            <div className="report-modal__projects-list">
              {formData.objectItems.map((objectItem, index) => (
                <div key={`object-${index}`} className="report-modal__project-row">
                  <input
                    type="text"
                    value={objectItem}
                    onChange={(event) => handleObjectChange(index, event.target.value)}
                    placeholder={`Объект ${index + 1}`}
                    list="objectsList"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="btn btn-cancel report-modal__project-remove"
                    onClick={() => handleRemoveObject(index)}
                    disabled={isSubmitting || formData.objectItems.length <= 1}
                    aria-label={`Удалить объект ${index + 1}`}
                  >
                    <X size={14} aria-hidden="true" />
                    Убрать
                  </button>
                </div>
              ))}
            </div>
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

          <div className="form-group">
            <label htmlFor="visibility">Видимость *</label>
            <select
              id="visibility"
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            >
              <option value="public">Публичное</option>
              {allowPrivateVisibility && <option value="private">Личное</option>}
            </select>
            {!allowPrivateVisibility && (
              <small className="form-help">Для вашей роли доступны только публичные мероприятия.</small>
            )}
          </div>

          {displayError && (
            <div className="modal-error" role="alert">{displayError}</div>
          )}

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
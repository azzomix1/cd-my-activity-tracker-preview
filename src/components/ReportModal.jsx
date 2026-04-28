import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { fromInputDateFormat } from '../utils/dateUtils';

function toInputValue(dateString) {
  if (!dateString) {
    return '';
  }

  const parts = String(dateString).split('.');

  if (parts.length !== 3) {
    return '';
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function normalizeDateForInput(dateString) {
  const normalized = String(dateString || '').trim();

  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  return toInputValue(normalized);
}

function createInitialReportData(activity, draftData = null) {
  const report = activity?.reportData;

  if (draftData) {
    return {
      date: normalizeDateForInput(draftData.date) || normalizeDateForInput(activity?.date),
      time: draftData.time || '',
      employeeName: draftData.employeeName || activity?.person || '',
      meetingContent: draftData.meetingContent || activity?.name || '',
      meetingFormat: draftData.meetingFormat || '',
      projects: Array.isArray(draftData.projects) ? draftData.projects : [],
      notificationsCount: draftData.notificationsCount || '',
      telegramSubscriptionsCount: draftData.telegramSubscriptionsCount || '',
      comment: draftData.comment || '',
    };
  }

  return {
    date: normalizeDateForInput(report?.date || activity?.date),
    time: report?.time || activity?.time || '',
    employeeName: report?.employeeName || activity?.person || '',
    meetingContent: report?.meetingContent || activity?.name || '',
    meetingFormat: report?.meetingFormat || '',
    projects: Array.isArray(report?.projects) ? report.projects : [],
    notificationsCount: report?.notificationsCount || '',
    telegramSubscriptionsCount: report?.telegramSubscriptionsCount || '',
    comment: report?.comment || '',
  };
}

function createFormState(initialFormData) {
  return {
    initialSnapshot: JSON.stringify(initialFormData),
    value: initialFormData,
  };
}

function formStateReducer(state, action) {
  if (action.type === 'syncInitial') {
    const nextInitialSnapshot = JSON.stringify(action.payload);

    if (state.initialSnapshot === nextInitialSnapshot) {
      return state;
    }

    const currentSnapshot = JSON.stringify(state.value);

    if (currentSnapshot === state.initialSnapshot) {
      return {
        initialSnapshot: nextInitialSnapshot,
        value: action.payload,
      };
    }

    return {
      ...state,
      initialSnapshot: nextInitialSnapshot,
    };
  }

  if (action.type === 'replace') {
    return {
      ...state,
      value: action.payload,
    };
  }

  if (action.type === 'patch') {
    return {
      ...state,
      value: {
        ...state.value,
        ...action.payload,
      },
    };
  }

  if (action.type === 'updateProjects') {
    return {
      ...state,
      value: {
        ...state.value,
        projects: action.payload,
      },
    };
  }

  return state;
}

function ReportModal({
  isOpen,
  activity,
  draftData,
  onClose,
  onDraftChange,
  onDiscardDraft,
  onSave,
  isSubmitting,
}) {
  const initialFormData = useMemo(() => createInitialReportData(activity, draftData), [activity, draftData]);
  const baselineFormData = useMemo(() => createInitialReportData(activity), [activity]);
  const [formState, dispatchFormState] = useReducer(formStateReducer, initialFormData, createFormState);
  const skipNextDraftSyncRef = useRef(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const isEditMode = Boolean(activity?.reportData);
  const hasSavedDraft = Boolean(draftData);
  const formData = formState.value;
  const isBusy = isSubmitting || isDiscarding;

  useEffect(() => {
    dispatchFormState({ type: 'syncInitial', payload: initialFormData });
  }, [initialFormData]);

  useEffect(() => {
    if (!isOpen || !activity || typeof onDraftChange !== 'function') {
      return;
    }

    if (skipNextDraftSyncRef.current) {
      skipNextDraftSyncRef.current = false;
      return;
    }

    const currentSnapshot = JSON.stringify(formData);
    const baselineSnapshot = JSON.stringify(baselineFormData);
    onDraftChange(activity.id, currentSnapshot === baselineSnapshot ? null : formData);
  }, [activity, baselineFormData, formData, isOpen, onDraftChange]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, isOpen, onClose]);

  if (!isOpen || !activity) {
    return null;
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && !isBusy) {
      onClose();
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    dispatchFormState({ type: 'patch', payload: { [name]: value } });
  }

  function handleProjectChange(index, value) {
    dispatchFormState({
      type: 'updateProjects',
      payload: formData.projects.map((project, projectIndex) => (
        projectIndex === index ? value : project
      )),
    });
  }

  function handleAddProject() {
    dispatchFormState({
      type: 'updateProjects',
      payload: [...formData.projects, ''],
    });
  }

  function handleRemoveProject(index) {
    dispatchFormState({
      type: 'updateProjects',
      payload: formData.projects.filter((_, projectIndex) => projectIndex !== index),
    });
  }

  async function handleDiscardDraft() {
    if (typeof onDiscardDraft !== 'function' || isBusy) {
      return;
    }

    setIsDiscarding(true);

    try {
      const result = await onDiscardDraft(activity.id);

      if (result?.success !== false) {
        skipNextDraftSyncRef.current = true;
        dispatchFormState({ type: 'replace', payload: baselineFormData });
      }
    } finally {
      setIsDiscarding(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    await onSave({
      date: fromInputDateFormat(formData.date),
      time: formData.time.trim(),
      employeeName: formData.employeeName.trim(),
      meetingContent: formData.meetingContent.trim(),
      meetingFormat: formData.meetingFormat.trim(),
      projects: formData.projects.map((project) => project.trim()).filter(Boolean),
      notificationsCount: formData.notificationsCount.trim(),
      telegramSubscriptionsCount: formData.telegramSubscriptionsCount.trim(),
      comment: formData.comment.trim(),
    });
  }

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal modal--report">
        <h3>{isEditMode ? 'Редактировать отчет' : 'Заполнить отчет'}</h3>

        <div className="report-modal__summary">
          <div className="report-modal__summary-label">Мероприятие</div>
          <div className="report-modal__summary-value">{activity.name}</div>
          <div className="report-modal__summary-meta">
            <span>{activity.date}</span>
            {activity.time && <span>{activity.time}</span>}
            {activity.person && <span>{activity.person}</span>}
            {hasSavedDraft && <span>Есть черновик</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="report-modal__grid">
            <div className="form-group">
              <label htmlFor="report-date">Дата *</label>
              <input
                type="date"
                id="report-date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                disabled={isBusy}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="report-time">Время</label>
              <input
                type="time"
                id="report-time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-employee">ФИО сотрудника *</label>
            <input
              type="text"
              id="report-employee"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              placeholder="Например, Антон"
              disabled={isBusy}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="report-content">Содержание встречи *</label>
            <textarea
              id="report-content"
              name="meetingContent"
              value={formData.meetingContent}
              onChange={handleChange}
              placeholder="Например, Проекты Юнити"
              rows={3}
              disabled={isBusy}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="report-format">Формат встречи *</label>
            <textarea
              id="report-format"
              name="meetingFormat"
              value={formData.meetingFormat}
              onChange={handleChange}
              placeholder="Например, Презентация"
              rows={2}
              disabled={isBusy}
              required
            />
          </div>

          <div className="form-group">
            <div className="report-modal__projects-header">
              <label>Проекты</label>
              <button
                type="button"
                className="btn btn-edit report-modal__project-add"
                onClick={handleAddProject}
                disabled={isBusy}
              >
                <Plus size={14} aria-hidden="true" />
                Добавить проект
              </button>
            </div>

            <div className="report-modal__projects-list">
              {formData.projects.length === 0 ? (
                <div className="report-modal__projects-empty">Можно оставить пустым, если проект не нужен.</div>
              ) : (
                formData.projects.map((project, index) => (
                  <div key={`project-${index}`} className="report-modal__project-row">
                    <input
                      type="text"
                      value={project}
                      onChange={(event) => handleProjectChange(index, event.target.value)}
                      placeholder={`Проект ${index + 1}`}
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      className="btn btn-cancel report-modal__project-remove"
                      onClick={() => handleRemoveProject(index)}
                      disabled={isBusy}
                      aria-label={`Удалить проект ${index + 1}`}
                    >
                      <X size={14} aria-hidden="true" />
                      Убрать
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="report-modal__grid">
            <div className="form-group">
              <label htmlFor="report-notifications">Уведомлений</label>
              <input
                type="number"
                id="report-notifications"
                name="notificationsCount"
                value={formData.notificationsCount}
                onChange={handleChange}
                placeholder="Например, 10"
                min="0"
                disabled={isBusy}
              />
            </div>

            <div className="form-group">
              <label htmlFor="report-telegram">Кол-во подписок на ТГ</label>
              <input
                type="number"
                id="report-telegram"
                name="telegramSubscriptionsCount"
                value={formData.telegramSubscriptionsCount}
                onChange={handleChange}
                placeholder="Например, 3"
                min="0"
                disabled={isBusy}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-comment">Комментарий</label>
            <textarea
              id="report-comment"
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              placeholder="Можно оставить развернутый комментарий по итогам встречи"
              rows={6}
              disabled={isBusy}
            />
          </div>

          <div className="modal-buttons">
            <button type="button" className="btn btn-cancel" onClick={onClose} disabled={isBusy}>
              Отмена
            </button>
            {hasSavedDraft && (
              <button
                type="button"
                className="btn btn-edit"
                onClick={handleDiscardDraft}
                disabled={isBusy}
              >
                {isDiscarding ? 'Очищаем...' : 'Очистить черновик'}
              </button>
            )}
            <button type="submit" className="btn btn-save" disabled={isBusy}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить отчет'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;
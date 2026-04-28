import { useEffect, useReducer, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check, EyeOff, Eye } from 'lucide-react';
import {
  fetchAdminObjects,
  createAdminObject,
  updateAdminObject,
  setAdminObjectActive,
  deleteAdminObject,
} from '../services/adminApi';

const EMPTY_FORM = { name: '', address: '', description: '' };

function objectsReducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...state, items: action.payload, isLoading: false, error: '' };
    case 'error':
      return { ...state, isLoading: false, error: action.payload };
    case 'upsert': {
      const exists = state.items.some((o) => o.id === action.payload.id);
      return {
        ...state,
        items: exists
          ? state.items.map((o) => (o.id === action.payload.id ? action.payload : o))
          : [...state.items, action.payload],
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((o) => o.id !== action.payload) };
    default:
      return state;
  }
}

export default function AdminObjectsPanel({ isReadOnly = false }) {
  const [state, dispatch] = useReducer(objectsReducer, { items: [], isLoading: true, error: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    fetchAdminObjects()
      .then((items) => {
        if (isMounted) dispatch({ type: 'loaded', payload: items });
      })
      .catch((err) => {
        if (isMounted) dispatch({ type: 'error', payload: err.message || 'Не удалось загрузить объекты.' });
      });

    return () => { isMounted = false; };
  }, []);

  function startAdd() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setActionError('');
    setIsAdding(true);
  }

  function startEdit(obj) {
    setIsAdding(false);
    setFormData({ name: obj.name, address: obj.address, description: obj.description });
    setActionError('');
    setEditingId(obj.id);
  }

  function cancelForm() {
    setIsAdding(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setActionError('');
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setActionError('Название обязательно.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    try {
      if (editingId !== null) {
        const updated = await updateAdminObject(editingId, formData);
        dispatch({ type: 'upsert', payload: updated });
      } else {
        const created = await createAdminObject(formData);
        dispatch({ type: 'upsert', payload: created });
      }
      cancelForm();
    } catch (err) {
      setActionError(err.message || 'Не удалось сохранить объект.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(obj) {
    setIsSaving(true);
    setActionError('');
    try {
      const updated = await setAdminObjectActive(obj.id, !obj.isActive);
      dispatch({ type: 'upsert', payload: updated });
    } catch (err) {
      setActionError(err.message || 'Не удалось изменить статус.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    setIsSaving(true);
    setActionError('');
    try {
      await deleteAdminObject(id);
      dispatch({ type: 'remove', payload: id });
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err.message || 'Не удалось удалить объект.');
    } finally {
      setIsSaving(false);
    }
  }

  const { items, isLoading, error } = state;

  return (
    <div className="objects-panel">
      <div className="objects-panel__header">
        <span className="objects-panel__title">Объекты</span>
        {!isReadOnly && (
          <button
            type="button"
            className="btn btn-edit objects-panel__add-btn"
            onClick={startAdd}
            disabled={isSaving || isAdding}
          >
            <Plus size={14} aria-hidden="true" />
            Добавить
          </button>
        )}
      </div>

      {error && <div className="objects-panel__error">{error}</div>}
      {actionError && <div className="objects-panel__error">{actionError}</div>}

      {isLoading && <div className="objects-panel__loading">Загрузка…</div>}

      {isAdding && (
        <div className="objects-panel__form">
          <div className="objects-panel__form-title">Новый объект</div>
          <ObjectForm
            formData={formData}
            onChange={setFormData}
            onSave={handleSave}
            onCancel={cancelForm}
            isSaving={isSaving}
          />
        </div>
      )}

      {!isLoading && items.length === 0 && !isAdding && (
        <div className="objects-panel__empty">Объекты не добавлены.</div>
      )}

      <ul className="objects-panel__list">
        {items.map((obj) => (
          <li key={obj.id} className={`objects-panel__item${obj.isActive ? '' : ' objects-panel__item--inactive'}`}>
            {editingId === obj.id ? (
              <div className="objects-panel__form">
                <div className="objects-panel__form-title">Редактирование</div>
                <ObjectForm
                  formData={formData}
                  onChange={setFormData}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  isSaving={isSaving}
                />
              </div>
            ) : (
              <>
                <div className="objects-panel__item-main">
                  <span className="objects-panel__item-name">{obj.name}</span>
                  {!obj.isActive && <span className="objects-panel__item-badge">Неактивен</span>}
                </div>
                {obj.address && <div className="objects-panel__item-address">{obj.address}</div>}
                {obj.description && <div className="objects-panel__item-desc">{obj.description}</div>}

                {!isReadOnly && (
                  <div className="objects-panel__item-actions">
                    {confirmDeleteId === obj.id ? (
                      <>
                        <span className="objects-panel__confirm-text">Удалить?</span>
                        <button
                          type="button"
                          className="btn btn-cancel objects-panel__action-btn"
                          onClick={() => handleDelete(obj.id)}
                          disabled={isSaving}
                        >
                          <Check size={13} aria-hidden="true" />
                          Да
                        </button>
                        <button
                          type="button"
                          className="btn btn-edit objects-panel__action-btn"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isSaving}
                        >
                          <X size={13} aria-hidden="true" />
                          Нет
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-edit objects-panel__action-btn"
                          onClick={() => startEdit(obj)}
                          disabled={isSaving}
                          title="Редактировать"
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-edit objects-panel__action-btn"
                          onClick={() => handleToggleActive(obj)}
                          disabled={isSaving}
                          title={obj.isActive ? 'Деактивировать' : 'Активировать'}
                        >
                          {obj.isActive ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className="btn btn-cancel objects-panel__action-btn"
                          onClick={() => setConfirmDeleteId(obj.id)}
                          disabled={isSaving}
                          title="Удалить"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObjectForm({ formData, onChange, onSave, onCancel, isSaving }) {
  return (
    <div className="objects-panel__form-fields">
      <input
        type="text"
        className="objects-panel__input"
        placeholder="Название *"
        value={formData.name}
        onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
        disabled={isSaving}
      />
      <input
        type="text"
        className="objects-panel__input"
        placeholder="Адрес"
        value={formData.address}
        onChange={(e) => onChange((prev) => ({ ...prev, address: e.target.value }))}
        disabled={isSaving}
      />
      <input
        type="text"
        className="objects-panel__input"
        placeholder="Описание"
        value={formData.description}
        onChange={(e) => onChange((prev) => ({ ...prev, description: e.target.value }))}
        disabled={isSaving}
      />
      <div className="objects-panel__form-btns">
        <button
          type="button"
          className="btn btn-edit"
          onClick={onSave}
          disabled={isSaving}
        >
          <Check size={14} aria-hidden="true" />
          Сохранить
        </button>
        <button
          type="button"
          className="btn btn-cancel"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X size={14} aria-hidden="true" />
          Отмена
        </button>
      </div>
    </div>
  );
}

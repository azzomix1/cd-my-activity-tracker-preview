import { useEffect, useRef, useState } from 'react';
import { fetchAdminFeedback, setFeedbackTags, deleteFeedbackMessage } from '../services/adminApi';

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FeedbackItem({ item, onTagsChange, onDelete }) {
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemError, setItemError] = useState('');
  const inputRef = useRef(null);

  async function handleAddTag() {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if (item.tags.includes(tag)) {
      setTagInput('');
      return;
    }

    const nextTags = [...item.tags, tag];
    setIsSaving(true);
    setItemError('');

    try {
      const updated = await setFeedbackTags(item.id, nextTags);
      onTagsChange(item.id, updated.tags);
      setTagInput('');
    } catch (err) {
      setItemError(err.message || 'Не удалось сохранить тег.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveTag(tag) {
    const nextTags = item.tags.filter((t) => t !== tag);
    setIsSaving(true);
    setItemError('');

    try {
      const updated = await setFeedbackTags(item.id, nextTags);
      onTagsChange(item.id, updated.tags);
    } catch (err) {
      setItemError(err.message || 'Не удалось удалить тег.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setItemError('');

    try {
      await deleteFeedbackMessage(item.id);
      onDelete(item.id);
    } catch (err) {
      setItemError(err.message || 'Не удалось удалить сообщение.');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <li className="admin-feedback-panel__item">
      <div className="admin-feedback-panel__meta">
        <strong>{item.senderName || item.senderEmail || 'Пользователь'}</strong>
        <span>{item.senderEmail || '—'}</span>
        <span>{formatDateTime(item.createdAt)}</span>
      </div>

      <div className="admin-feedback-panel__message">{item.message}</div>

      <div className="admin-feedback-panel__tags">
        {item.tags.map((tag) => (
          <span key={tag} className="admin-feedback-panel__tag">
            {tag}
            <button
              className="admin-feedback-panel__tag-remove"
              onClick={() => handleRemoveTag(tag)}
              disabled={isSaving}
              title="Удалить тег"
              aria-label={`Удалить тег ${tag}`}
            >
              ×
            </button>
          </span>
        ))}

        <div className="admin-feedback-panel__tag-add">
          <input
            ref={inputRef}
            className="admin-feedback-panel__tag-input"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Новый тег"
            disabled={isSaving}
            maxLength={50}
          />
          <button
            className="admin-feedback-panel__tag-btn"
            onClick={handleAddTag}
            disabled={isSaving || !tagInput.trim()}
          >
            +
          </button>
        </div>
      </div>

      {itemError && <div className="admin-feedback-panel__item-error">{itemError}</div>}

      <div className="admin-feedback-panel__actions">
        {confirmDelete ? (
          <>
            <span className="admin-feedback-panel__delete-confirm-text">Удалить сообщение?</span>
            <button
              className="admin-feedback-panel__btn admin-feedback-panel__btn--danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Удаление...' : 'Да'}
            </button>
            <button
              className="admin-feedback-panel__btn"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
            >
              Нет
            </button>
          </>
        ) : (
          <button
            className="admin-feedback-panel__btn admin-feedback-panel__btn--danger"
            onClick={() => setConfirmDelete(true)}
          >
            Удалить
          </button>
        )}
      </div>
    </li>
  );
}

export default function AdminFeedbackPanel() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadFeedback() {
      setIsLoading(true);
      setError('');

      try {
        const nextItems = await fetchAdminFeedback(100);

        if (!isMounted) {
          return;
        }

        setItems(nextItems);
      } catch (nextError) {
        if (!isMounted) {
          return;
        }

        setError(nextError.message || 'Не удалось загрузить обратную связь.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadFeedback();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleTagsChange(id, nextTags) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, tags: nextTags } : it)));
  }

  function handleDelete(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  return (
    <section className="admin-panel admin-feedback-panel">
      <div className="admin-panel__header">
        <div>
          <h3 className="admin-panel__title">Обратная связь</h3>
          <p className="admin-panel__subtitle">Последние сообщения от пользователей.</p>
        </div>
      </div>

      {error && <div className="admin-panel__error">{error}</div>}

      <div className="admin-panel__body admin-feedback-panel__body">
        {isLoading ? (
          <div className="admin-panel__empty">Загрузка данных...</div>
        ) : items.length === 0 ? (
          <div className="admin-panel__empty">Сообщений пока нет.</div>
        ) : (
          <ul className="admin-feedback-panel__list">
            {items.map((item) => (
              <FeedbackItem
                key={item.id}
                item={item}
                onTagsChange={handleTagsChange}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

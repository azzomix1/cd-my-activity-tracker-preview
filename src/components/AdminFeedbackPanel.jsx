import { useEffect, useState } from 'react';
import { fetchAdminFeedback } from '../services/adminApi';

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
              <li key={item.id} className="admin-feedback-panel__item">
                <div className="admin-feedback-panel__meta">
                  <strong>{item.senderName || item.senderEmail || 'Пользователь'}</strong>
                  <span>{item.senderEmail || '—'}</span>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <div className="admin-feedback-panel__message">{item.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

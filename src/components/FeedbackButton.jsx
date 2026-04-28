import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { sendFeedbackToApi } from '../services/feedbackApi';

const MAX_LENGTH = 2000;

const STATES = {
  IDLE: 'idle',
  OPEN: 'open',
  SENDING: 'sending',
  SUCCESS: 'success',
  ERROR: 'error',
};

export default function FeedbackButton() {
  const [state, setState] = useState(STATES.IDLE);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const panelRef = useRef(null);
  const textareaRef = useRef(null);

  const open = useCallback(() => {
    setState(STATES.OPEN);
    setMessage('');
    setErrorText('');
  }, []);

  const close = useCallback(() => {
    setState(STATES.IDLE);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setState(STATES.SENDING);
    try {
      await sendFeedbackToApi(trimmed);
      setState(STATES.SUCCESS);
    } catch (err) {
      setErrorText(err.message || 'Не удалось отправить.');
      setState(STATES.ERROR);
    }
  }, [message]);

  // Close panel on Escape
  useEffect(() => {
    if (state === STATES.IDLE) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, close]);

  // Focus textarea on open
  useEffect(() => {
    if (state === STATES.OPEN) {
      textareaRef.current?.focus();
    }
  }, [state]);

  // Close on outside click
  useEffect(() => {
    if (state === STATES.IDLE) return;

    const handlePointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [state, close]);

  const isOpen = state !== STATES.IDLE;

  return (
    <div className="feedback-widget" ref={panelRef}>
      <button
        type="button"
        className={`feedback-trigger${isOpen ? ' feedback-trigger--active' : ''}`}
        onClick={isOpen ? close : open}
        aria-label="Обратная связь"
        title="Оставить обратную связь"
      >
        <MessageSquare size={14} aria-hidden="true" />
        <span>Обратная связь</span>
      </button>

      {isOpen && (
        <div className="feedback-panel" role="dialog" aria-modal="true" aria-label="Обратная связь">
          <div className="feedback-panel__header">
            <span className="feedback-panel__title">Обратная связь</span>
            <button
              type="button"
              className="feedback-panel__close"
              onClick={close}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {state === STATES.SUCCESS ? (
            <div className="feedback-panel__success">
              <div className="feedback-panel__success-icon">✓</div>
              <p>Спасибо! Сообщение отправлено.</p>
              <button type="button" className="feedback-panel__send-btn" onClick={close}>
                Закрыть
              </button>
            </div>
          ) : (
            <form className="feedback-panel__body" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                className="feedback-panel__textarea"
                placeholder="Напишите, что можно улучшить или что вас беспокоит..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (state === STATES.ERROR) setState(STATES.OPEN);
                }}
                maxLength={MAX_LENGTH}
                rows={5}
                disabled={state === STATES.SENDING}
                required
              />
              <div className="feedback-panel__footer">
                <span className="feedback-panel__counter">
                  {message.length}/{MAX_LENGTH}
                </span>
                {state === STATES.ERROR && (
                  <span className="feedback-panel__error">{errorText}</span>
                )}
                <button
                  type="submit"
                  className="feedback-panel__send-btn"
                  disabled={state === STATES.SENDING || !message.trim()}
                >
                  {state === STATES.SENDING ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

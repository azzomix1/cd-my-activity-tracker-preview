import { getAuthToken } from '../auth/authTokenStorage';

const API_URL = import.meta.env.VITE_API_URL?.trim();

/**
 * @param {string} message
 * @returns {Promise<void>}
 */
export async function sendFeedbackToApi(message) {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Требуется авторизация.');
  }

  const response = await fetch(`${API_URL}/api/feedback`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Не удалось отправить обратную связь.');
  }
}

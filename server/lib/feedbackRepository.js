import { query } from './db.js';

function mapRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id || ''),
    senderName: String(row.sender_name || ''),
    senderEmail: String(row.sender_email || ''),
    message: String(row.message || ''),
    createdAt: row.created_at,
  };
}

export async function createFeedbackMessage({ userId = '', senderName = '', senderEmail = '', message = '' }) {
  const normalizedMessage = String(message || '').trim();

  if (!normalizedMessage) {
    throw new Error('Сообщение не может быть пустым.');
  }

  const result = await query(
    `
      insert into feedback_messages (user_id, sender_name, sender_email, message)
      values (nullif($1, ''), $2, $3, $4)
      returning id, user_id, sender_name, sender_email, message, created_at
    `,
    [
      String(userId || '').trim(),
      String(senderName || '').trim(),
      String(senderEmail || '').trim().toLowerCase(),
      normalizedMessage,
    ],
  );

  return mapRow(result.rows[0]);
}

export async function listFeedbackMessages({ limit = 100 } = {}) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 500) : 100;

  const result = await query(
    `
      select id, user_id, sender_name, sender_email, message, created_at
      from feedback_messages
      order by created_at desc
      limit $1
    `,
    [safeLimit],
  );

  return result.rows.map(mapRow);
}

export async function deleteFeedbackMessage(id) {
  const normalizedId = Number(id);
  if (!normalizedId) throw new Error('ID сообщения обязателен.');

  await query('delete from feedback_messages where id = $1', [normalizedId]);
}

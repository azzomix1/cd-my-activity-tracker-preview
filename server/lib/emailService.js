import nodemailer from 'nodemailer';

const FEEDBACK_TO = process.env.FEEDBACK_EMAIL || 'bolotnikoad@oneco.ru';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true'; // true = port 465

  if (!host || !user || !pass) {
    throw new Error('SMTP не настроен. Укажите SMTP_HOST, SMTP_USER, SMTP_PASS в .env.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * @param {{ senderName: string, senderEmail: string, message: string }} params
 */
export async function sendFeedbackEmail({ senderName, senderEmail, message }) {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"Activity Tracker" <${fromAddress}>`,
    to: FEEDBACK_TO,
    subject: `Обратная связь: ${senderName}`,
    text: `От: ${senderName} (${senderEmail})\n\n${message}`,
    html: `
      <p><strong>От:</strong> ${escapeHtml(senderName)} (<a href="mailto:${escapeHtml(senderEmail)}">${escapeHtml(senderEmail)}</a>)</p>
      <hr>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

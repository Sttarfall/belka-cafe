const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendEmail(subject, text) {
  try {
    const t = getTransporter();
    if (!t || !process.env.NOTIFY_EMAIL_TO) return; // не настроено — тихо пропускаем
    await t.sendMail({
      from: `"Сайт кафе «Белка»" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL_TO,
      subject,
      text,
    });
  } catch (err) {
    console.error('⚠️  Не удалось отправить email-уведомление:', err.message);
  }
}

async function sendTelegram(text) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return; // не настроено — тихо пропускаем
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('⚠️  Telegram API вернул ошибку:', res.status, body);
    }
  } catch (err) {
    console.error('⚠️  Не удалось отправить Telegram-уведомление:', err.message);
  }
}

async function notifyNewBooking(b) {
  const text =
    `Новая бронь столика на сайте «Белка»\n\n` +
    `Имя: ${b.name}\n` +
    `Телефон: ${b.phone}\n` +
    `Гостей: ${b.guests || '—'}\n` +
    `Дата: ${b.date}\n` +
    `Время: ${b.time}\n` +
    `Комментарий: ${b.comment || '—'}`;
  await Promise.all([
    sendEmail('Белка — новая бронь столика', text),
    sendTelegram(text),
  ]);
}

async function notifyNewMessage(m) {
  const text =
    `Новое сообщение с сайта «Белка»\n\n` +
    `Имя: ${m.name}\n` +
    `Контакт: ${m.contact}\n` +
    `Сообщение: ${m.message}`;
  await Promise.all([
    sendEmail('Белка — новое сообщение с сайта', text),
    sendTelegram(text),
  ]);
}

function logNotificationStatus() {
  console.log(process.env.SMTP_HOST
    ? '✅ Email-уведомления настроены'
    : 'ℹ️  Email-уведомления не настроены (см. .env)');
  console.log(process.env.TELEGRAM_BOT_TOKEN
    ? '✅ Telegram-уведомления настроены'
    : 'ℹ️  Telegram-уведомления не настроены (см. .env)');
}

module.exports = { sendEmail, sendTelegram, notifyNewBooking, notifyNewMessage, logNotificationStatus };

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const notify = require('./notify');

process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Необработанная ошибка (unhandledRejection):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Необработанное исключение (uncaughtException):', err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) app.set('trust proxy', 1); // нужно на Render/Railway/за прокси, чтобы secure-cookie работали

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 8, // 8 часов
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Требуется авторизация администратора' });
}

/* ---------------- admin auth ---------------- */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) {
      return res.status(500).json({ error: 'ADMIN_PASSWORD_HASH не задан на сервере. Проверьте файл .env.' });
    }
    if (!password) return res.status(400).json({ error: 'Введите пароль' });
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: 'Неверный пароль' });
    req.session.isAdmin = true;
    res.json({ ok: true });
  } catch (err) {
    console.error('Ошибка при входе администратора:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при входе. Проверьте ADMIN_PASSWORD_HASH в .env.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.isAdmin) });
});

/* ---------------- меню ---------------- */
app.get('/api/menu', (req, res) => {
  res.json(db.getMenu());
});

app.post('/api/menu', requireAdmin, (req, res) => {
  const { category, name, description, price } = req.body || {};
  if (!category || !name) return res.status(400).json({ error: 'Укажите категорию и название' });
  res.json(db.addMenuItem({ category, name, description, price: Number(price) || 0 }));
});

app.put('/api/menu/:id', requireAdmin, (req, res) => {
  const updated = db.updateMenuItem(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Позиция не найдена' });
  res.json(updated);
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  db.deleteMenuItem(req.params.id);
  res.json({ ok: true });
});

/* ---------------- валидация брони ---------------- */
function normalizeRuPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return '+7' + digits.slice(1);
  }
  return null;
}
function isValidBookingDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (d.getFullYear() !== now.getFullYear()) return false;
  if (d < now) return false;
  return true;
}
function isValidBookingTime(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr || '')) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const minutes = h * 60 + m;
  return minutes >= 11 * 60 && minutes <= 23 * 60;
}

/* ---------------- брони ---------------- */
app.post('/api/bookings', (req, res) => {
  const { name, phone, guests, date, time, comment } = req.body || {};
  if (!name || !phone || !date || !time) {
    return res.status(400).json({ error: 'Заполните имя, телефон, дату и время' });
  }
  const normalizedPhone = normalizeRuPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Введите номер телефона в формате +7 (___) ___-__-__' });
  }
  if (!isValidBookingDate(date)) {
    return res.status(400).json({ error: 'Дата бронирования должна быть сегодня или позже, в пределах текущего года' });
  }
  if (!isValidBookingTime(time)) {
    return res.status(400).json({ error: 'Мы принимаем брони с 11:00 до 23:00' });
  }
  const result = db.addBooking({ name, phone: normalizedPhone, guests, date, time, comment });
  notify.notifyNewBooking({ name, phone: normalizedPhone, guests, date, time, comment });
  res.json({ ok: true, id: result.id });
});

app.get('/api/bookings', requireAdmin, (req, res) => {
  res.json(db.getBookings());
});

app.delete('/api/bookings/:id', requireAdmin, (req, res) => {
  db.deleteBooking(req.params.id);
  res.json({ ok: true });
});

/* ---------------- сообщения ---------------- */
app.post('/api/messages', (req, res) => {
  const { name, contact, message } = req.body || {};
  if (!name || !contact || !message) {
    return res.status(400).json({ error: 'Заполните все поля формы' });
  }
  const result = db.addMessage({ name, contact, message });
  notify.notifyNewMessage({ name, contact, message }); // не блокирует ответ, ошибки гасятся внутри
  res.json({ ok: true, id: result.id });
});

app.get('/api/messages', requireAdmin, (req, res) => {
  res.json(db.getMessages());
});

app.delete('/api/messages/:id', requireAdmin, (req, res) => {
  db.deleteMessage(req.params.id);
  res.json({ ok: true });
});

// Общий обработчик ошибок — если что-то в маршрутах выше сломается,
// сервер вернёт понятную ошибку в JSON, а не упадёт молча.
app.use((err, req, res, next) => {
  console.error('⚠️  Ошибка в обработчике запроса:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`Белка-кафе сервер запущен: http://localhost:${PORT}`);
  notify.logNotificationStatus();
});

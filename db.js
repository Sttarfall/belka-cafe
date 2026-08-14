const path = require('path');
const fs = require('fs');

// Простая база данных на основе JSON-файла — без нативной компиляции (не требует
// Visual Studio/build tools, работает одинаково на Windows/Mac/Linux и на любом хостинге).
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbFile = path.join(dataDir, 'belka-db.json');

const DEFAULT_MENU = [
  { id: 'm1', category: 'Напитки', name: 'Флэт уайт', description: 'Двойной эспрессо, молоко', price: 270 },
  { id: 'm2', category: 'Напитки', name: 'Тыквенный латте', description: 'Сезонный, с корицей', price: 310 },
  { id: 'm3', category: 'Напитки', name: 'Какао домашнее', description: 'На топлёном молоке', price: 260 },
  { id: 'm4', category: 'Выпечка', name: 'Тыквенный пирог', description: 'Кусочек с орехами', price: 250 },
  { id: 'm5', category: 'Выпечка', name: 'Круассан', description: 'Классический, масляный', price: 190 },
  { id: 'm6', category: 'Завтраки', name: 'Сырники', description: 'Со сметаной и джемом', price: 340 },
  { id: 'm7', category: 'Обеды', name: 'Суп дня', description: 'Уточняйте у бариста', price: 300 },
  { id: 'm8', category: 'Обеды', name: 'Сэндвич с индейкой', description: 'Чиабатта, овощи', price: 380 },
];

function freshData() {
  return { menu: DEFAULT_MENU, bookings: [], messages: [], nextBookingId: 1, nextMessageId: 1 };
}

function loadData() {
  if (!fs.existsSync(dbFile)) {
    const initial = freshData();
    fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    if (!parsed.menu) parsed.menu = DEFAULT_MENU;
    if (!parsed.bookings) parsed.bookings = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.nextBookingId) parsed.nextBookingId = 1;
    if (!parsed.nextMessageId) parsed.nextMessageId = 1;
    return parsed;
  } catch (e) {
    console.error('Файл базы данных повреждён, создаю новый:', e.message);
    const initial = freshData();
    fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function saveData(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

module.exports = {
  // ---- меню ----
  getMenu() {
    return loadData().menu;
  },
  addMenuItem({ category, name, description, price }) {
    const data = loadData();
    const id = 'm' + Date.now() + Math.floor(Math.random() * 1000);
    const item = { id, category, name, description: description || '', price: price || 0 };
    data.menu.push(item);
    saveData(data);
    return item;
  },
  updateMenuItem(id, fields) {
    const data = loadData();
    const item = data.menu.find(i => i.id === id);
    if (!item) return null;
    if (fields.category !== undefined) item.category = fields.category;
    if (fields.name !== undefined) item.name = fields.name;
    if (fields.description !== undefined) item.description = fields.description;
    if (fields.price !== undefined) item.price = Number(fields.price) || 0;
    saveData(data);
    return item;
  },
  deleteMenuItem(id) {
    const data = loadData();
    data.menu = data.menu.filter(i => i.id !== id);
    saveData(data);
  },

  // ---- брони ----
  addBooking({ name, phone, guests, date, time, comment }) {
    const data = loadData();
    const id = data.nextBookingId++;
    data.bookings.push({
      id, name, phone, guests,
      booking_date: date, booking_time: time,
      comment: comment || '', created_at: new Date().toISOString(),
    });
    saveData(data);
    return { id };
  },
  getBookings() {
    return loadData().bookings.slice().reverse();
  },
  deleteBooking(id) {
    const data = loadData();
    const numId = Number(id);
    data.bookings = data.bookings.filter(b => b.id !== numId);
    saveData(data);
  },

  // ---- сообщения ----
  addMessage({ name, contact, message }) {
    const data = loadData();
    const id = data.nextMessageId++;
    data.messages.push({ id, name, contact, message, created_at: new Date().toISOString() });
    saveData(data);
    return { id };
  },
  getMessages() {
    return loadData().messages.slice().reverse();
  },
  deleteMessage(id) {
    const data = loadData();
    const numId = Number(id);
    data.messages = data.messages.filter(m => m.id !== numId);
    saveData(data);
  },
};

// Утилита: превращает обычный пароль в bcrypt-хэш для .env (ADMIN_PASSWORD_HASH)
// Запуск: npm run seed-password
const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Введите пароль администратора, который хотите использовать: ', (password) => {
  if (!password || password.length < 6) {
    console.log('\nПароль должен быть не короче 6 символов. Запустите скрипт заново.');
    rl.close();
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  console.log('\nГотово! Скопируйте строку ниже в файл .env как значение ADMIN_PASSWORD_HASH:\n');
  console.log(hash);
  console.log('\nПример строки в .env:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  rl.close();
});

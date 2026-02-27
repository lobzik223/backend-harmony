# Создание админ-аккаунта (только из консоли сервера)

Админы панели создаются **только** через скрипт на сервере. В API нет метода регистрации админа — только вход по email/паролю.

## Команда

Из корня проекта `backend-harmony`:

```bash
node scripts/create-admin.js <email> <пароль>
```

Пароль: не менее 8 символов. В БД сохраняется только хэш (argon2).

Пример:

```bash
node scripts/create-admin.js admin@harmonymeditation.online "SecurePassword123"
```

Или через переменные окружения:

```bash
EMAIL=admin@example.com PASSWORD=YourPassword node scripts/create-admin.js
```

## Условия

- База должна быть доступна (`DATABASE_URL` в `.env`).
- Миграция с таблицей `Admin` должна быть применена: `npm run db:migrate`.
- Повторный email выдаст ошибку «Админ с таким email уже существует».

## После создания

Вход в панель: https://panel.harmonymeditation.online → почта и пароль, указанные при создании.

# Запуск Harmony Backend в Docker

Бэкенд работает с **PostgreSQL**. В Docker поднимаются контейнеры **postgres** и **backend**. Регистрация, вход и сессии хранятся только в БД; блокировка после неудачных попыток — тоже в БД.

## Требования

- Docker Desktop (или Docker 24+ / Docker Compose v2)
- Файл `.env` с `DATABASE_URL` (в compose подставляется автоматически для контейнера backend)

## Запуск на локалке

**Скрипт:**
```powershell
cd backend-harmony
.\run-docker.ps1
```

**Вручную:**
```powershell
cd backend-harmony
copy env.docker.example .env
docker compose up -d --build
```

В Docker Desktop появятся контейнеры **harmony_postgres** (порт 5432) и **harmony_backend** (порт 3000). При старте backend автоматически выполняется `prisma migrate deploy`.

**Проверка:**
- http://localhost:3000/api/health
- Регистрация и вход через API — данные строго в PostgreSQL.

## Локальный запуск без Docker

1. Установите PostgreSQL, создайте БД и пользователя.
2. Скопируйте `.env.example` в `.env`, задайте `DATABASE_URL` и JWT-секреты.
3. Выполните миграции: `npx prisma migrate deploy`
4. Запуск: `npm run dev` или `npm run start`

## Полезные команды

| Действие | Команда |
|----------|---------|
| Остановить | `docker compose down` |
| Логи backend | `docker compose logs -f backend` |
| Логи postgres | `docker compose logs -f postgres` |
| Пересборка | `docker compose up -d --build` |

## Переменные окружения

Обязательны: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. В production также нужен `APP_KEY`.

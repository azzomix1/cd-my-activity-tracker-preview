# PostgreSQL Setup For VK Cloud

Проект подготовлен к миграции с Google Sheets на PostgreSQL через локальный Node API.

## Что уже добавлено

- backend API: `server/index.js`
- PostgreSQL access layer: `server/lib/*.js`
- migration script: `scripts/db-migrate.mjs`
- migrations: `server/migrations/001_init.sql` ... `server/migrations/007_activity_person_alias_map.sql`
- frontend uses `VITE_API_URL`

## Какие таблицы создаются

- `activities`
- `activity_reports`
- `activity_report_drafts`
- `app_users`
- `auth_sessions`
- `user_hierarchy`
- `activity_person_alias_map`

На текущем этапе приложение уже может читать и писать:

- `activities`
- `activity_reports`
- `activity_report_drafts`

## Что нужно от VK Cloud

Вам нужна строка подключения в формате `DATABASE_URL`, например:

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Обычно VK Cloud PostgreSQL выдаёт:

- host
- port
- database name
- username
- password
- SSL requirement

## Важный принцип переезда

- Переносить данные из Yandex Cloud не требуется.
- Нужно подключить новый `DATABASE_URL` от VK Cloud и выполнить миграции на пустой БД.
- Миграции создадут ту же схему, которую использует текущий backend API.

## Локальная конфигурация

В корне проекта создайте или обновите `.env.local`:

```env
VITE_API_URL=http://localhost:8787/api
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
API_PORT=8787
CORS_ORIGIN=http://localhost:5173
```

## Первый запуск

1. Применить миграции:

```powershell
npm run db:migrate
```

Ожидаемый результат: `Database migrations completed successfully.`

2. Запустить backend API:

```powershell
npm run api:dev
```

3. В отдельном терминале запустить frontend:

```powershell
npm run dev
```

4. (Опционально) проверить API smoke-тест:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api-smoke-test.ps1
```

или

```powershell
npm run api:team-smoke
```

## Проверка подключения

Health-check backend:

```text
GET http://localhost:8787/api/health
```

Если PostgreSQL доступен, вы получите:

```json
{ "success": true, "status": "ok" }
```

## Что мигрировано на этом шаге

- чтение активностей
- создание активностей
- обновление активностей
- удаление активностей
- сохранение отчетов
- сохранение черновиков отчетов
- аутентификация/сессии пользователей
- иерархия руководитель-сотрудник
- алиасы сотрудников для связывания активности с пользователем

## Что ещё осталось перевести с localStorage

- в localStorage остаются только UI-настройки и тема

## Чек-лист готовности VK Cloud

1. В `.env.local` указан `DATABASE_URL` от VK Cloud.
2. `npm run db:migrate` выполняется без ошибок.
3. `GET /api/health` возвращает `{ "success": true, "status": "ok" }`.
4. Логин/создание активности/отчеты проходят через API без ошибок.
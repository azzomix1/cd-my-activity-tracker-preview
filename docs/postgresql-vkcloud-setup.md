# PostgreSQL Setup For VK Cloud

Проект подготовлен к миграции с Google Sheets на PostgreSQL через локальный Node API.

## Что уже добавлено

- backend API: `server/index.js`
- PostgreSQL access layer: `server/lib/*.js`
- migration script: `scripts/db-migrate.mjs`
- initial schema: `server/migrations/001_init.sql`
- frontend uses `VITE_API_URL`

## Какие таблицы создаются

- `activities`
- `activity_reports`
- `activity_report_drafts`

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

2. Запустить backend API:

```powershell
npm run api:dev
```

3. В отдельном терминале запустить frontend:

```powershell
npm run dev
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

## Что ещё осталось перевести с localStorage

- в localStorage остаются только UI-настройки и тема

## Важное ограничение

Без реального `DATABASE_URL` я не могу подключиться к вашей VK Cloud базе из среды автоматически.
Но проект уже подготовлен так, что после добавления строки подключения вам останется:

1. выполнить `npm run db:migrate`
2. запустить `npm run api:dev`
3. проверить `GET /api/health`
4. начать работу с PostgreSQL
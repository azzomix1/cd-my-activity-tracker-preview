# Activity Tracker

Веб-приложение для календаря активностей сотрудников, ведения отчетов и командной сводки.

## Технологии

- Frontend: React + Vite
- Backend API: Node.js + Express
- База данных: PostgreSQL
- Аутентификация: токен-сессии через API

## Структура проекта

- `src/` - актуальный frontend (Vite/React)
- `server/` - backend API и слой работы с PostgreSQL
- `server/migrations/` - SQL-миграции схемы
- `scripts/` - служебные скрипты (миграции, smoke tests, admin/auth задачи)
- `docs/` - проектная документация

## Требования

- Node.js 20+
- npm 10+
- PostgreSQL с доступной строкой подключения `DATABASE_URL`

## Быстрый старт (локально)

1. Установить зависимости:

```powershell
npm install
```

2. Создать `.env.local` в корне:

```env
VITE_API_URL=http://localhost:8787/api
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
API_PORT=8787
CORS_ORIGIN=http://localhost:5173
```

3. Применить миграции:

```powershell
npm run db:migrate
```

4. Запустить backend API:

```powershell
npm run api:dev
```

5. В отдельном терминале запустить frontend:

```powershell
npm run dev
```

6. Проверить health endpoint:

```text
GET http://localhost:8787/api/health
```

Ожидаемый ответ:

```json
{ "success": true, "status": "ok" }
```

## Переменные окружения

Обязательные для локальной разработки:

- `VITE_API_URL` - базовый URL API для frontend
- `DATABASE_URL` - строка подключения PostgreSQL

Опциональные:

- `API_PORT` - порт backend API (по умолчанию `8787`)
- `CORS_ORIGIN` - список origin через запятую для CORS
- `SMOKE_TEST_EMAIL` - логин для smoke-теста API
- `SMOKE_TEST_PASSWORD` - пароль для smoke-теста API

## Основные npm-скрипты

- `npm run dev` - запуск frontend (Vite)
- `npm run build` - production-сборка frontend
- `npm run preview` - просмотр production-сборки
- `npm run lint` - ESLint-проверка
- `npm run api` - запуск backend API
- `npm run api:dev` - запуск backend API в watch-режиме
- `npm run db:migrate` - запуск SQL-миграций
- `npm run db:seed-test-data` - сид тестовых данных
- `npm run db:check-integrity` - проверка целостности данных
- `npm run api:team-smoke` - smoke-тест сводки команды

## API-обзор

Ключевые группы endpoint-ов:

- `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`
- `GET/POST/PUT/DELETE /api/activities`
- `GET/PUT/DELETE /api/reports`
- `PUT/DELETE /api/report-drafts`
- `GET /api/public/activities`
- `GET /api/team/users`, `GET /api/team/summary`
- `GET/POST/DELETE /api/admin/hierarchy`, `POST /api/admin/hierarchy/bulk`

Для приватных endpoint-ов требуется `Authorization: Bearer <token>`.

## Документация

Полный индекс документации: [docs/README.md](docs/README.md)

Ключевые гайды:

- [PostgreSQL Setup](docs/postgresql-vkcloud-setup.md) - подключение и инициализация БД
- [API Reference](docs/api-reference.md) - описание всех endpoint-ов
- [Smoke Test](docs/api-smoke-test.md) - быстрый сквозной тест API
- [CSS Visual Baseline](docs/css-visual-baseline.md) - правила CSS-рефактора

## Замечания

- Основной рабочий проект запускается из корня репозитория.
- Frontend хранит в `localStorage` только UI-состояние (например, тема/фильтры); данные активностей и отчетов работают через API + PostgreSQL.

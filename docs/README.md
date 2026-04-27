# Документация Activity Tracker

Полное описание архитектуры, API и процессов разработки.

## Быстрый старт

Начните отсюда:

- [Activity Tracker README](../README.md) - общее описание проекта и быстрый старт в 6 шагов

## Руководства по подсистемам

### Backend & База данных

- [PostgreSQL Setup для VK Cloud](postgresql-vkcloud-setup.md)
  - Как подключить PostgreSQL из VK Cloud
  - Миграции и инициализация БД
  - Локальная конфигурация переменных окружения

### API

- [API Reference](api-reference.md)
  - Полное описание всех endpoint-ов
  - Примеры запросов/ответов для каждого endpoint
  - Группы: аутентификация, активности, отчеты, команда, администрирование
  - Информация о ролях и правах доступа

### Тестирование

- [API Smoke Test](api-smoke-test.md)
  - Сквозной тест backend API с авторизацией
  - Как запустить и интерпретировать результаты
  - Разбор типовых ошибок

### Frontend & CSS

- [CSS Visual Baseline](css-visual-baseline.md)
  - Визуальная базовая линия интерфейса
  - Правила изменений CSS без нарушения UI
  - Инварианты light/dark theme
  - Чек-лист после рефактора CSS

## Архитектура проекта

### Структура

```
.
├── src/                           # Frontend (React + Vite)
│   ├── App.jsx                   # Root component
│   ├── main.jsx                  # Entry point
│   ├── auth/                     # Аутентификация и сессия
│   ├── components/               # React компоненты
│   ├── hooks/                    # Custom React hooks
│   ├── services/                 # API клиент
│   └── utils/                    # Утилиты
│
├── server/                        # Backend API (Node.js + Express)
│   ├── index.js                  # API сервер и эндпоинты
│   ├── lib/                      # Слой работы с БД
│   │   ├── db.js                # PostgreSQL подключение
│   │   ├── activitiesRepository.js
│   │   ├── authRepository.js
│   │   ├── reportsRepository.js
│   │   └── ...
│   └── migrations/               # SQL миграции
│
├── scripts/                       # Служебные скрипты
│   ├── db-migrate.mjs           # Запуск миграций
│   ├── db-seed-test-data.mjs    # Сид тестовых данных
│   ├── api-smoke-test.ps1       # Smoke-тест API
│   └── ...
│
└── docs/                          # Документация
    ├── api-reference.md
    ├── api-smoke-test.md
    ├── postgresql-vkcloud-setup.md
    ├── css-visual-baseline.md
    └── README.md (этот файл)
```

### Слои

**Frontend (src/)**
- React компоненты для календаря, активностей, отчетов
- Session/auth контекст для управления авторизацией
- API клиент через `src/services/` для запросов к backend
- Локальное хранилище для UI-состояния (тема, фильтры)

**Backend (server/)**
- Express API с endpoint-ами для CRUD операций
- PostgreSQL клиент для работы с БД
- Миграции схемы
- Слой доступа (repositories) для разделения логики

**База данных (PostgreSQL)**
- Таблицы: `activities`, `activity_reports`, `activity_report_drafts`, `users`, `user_hierarchy`
- Применяется через `npm run db:migrate`

## Переменные окружения

Локальная разработка (`.env.local`):

```env
# Frontend
VITE_API_URL=http://localhost:8787/api

# Backend
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
API_PORT=8787
CORS_ORIGIN=http://localhost:5173

# Smoke test
SMOKE_TEST_EMAIL=test@example.com
SMOKE_TEST_PASSWORD=password123
```

## Основные команды

```bash
# Frontend
npm run dev              # Разработка (Vite)
npm run build           # Production-сборка
npm run preview         # Просмотр production-сборки

# Backend
npm run api             # Запуск API
npm run api:dev         # Запуск API в watch-режиме

# База данных
npm run db:migrate      # Применить миграции
npm run db:seed-test-data # Сид тестовых данных
npm run db:check-integrity # Проверка целостности

# Тестирование
npm run lint            # ESLint-проверка
npm run api:team-smoke  # Smoke-тест сводки команды
```

Для быстрого smoke-теста API с авторизацией см. [api-smoke-test.md](api-smoke-test.md).

## Роли и права доступа

- `employee` - базовый сотрудник, видит только свои активности
- `line_manager` - руководитель, видит активности своих подчиненных
- `full_manager` - расширенные права, может управлять иерархией
- `administrator` - полный доступ

Политика доступа реализована в:
- Frontend: `src/auth/accessPolicy.js`
- Backend: `server/index.js` (middleware `requireAuth`, `requireHierarchyAdmin`, и т.д.)

## Data Flow

### Создание активности

1. Пользователь заполняет форму в `ActivityModal` (frontend)
2. `useActivities` hook отправляет `POST /api/activities` через `activitiesApi`
3. Backend проверяет авторизацию и права доступа
4. Активность сохраняется в PostgreSQL
5. Ответ возвращается frontend, UI обновляется

### Просмотр отчетов

1. Пользователь открывает `ReportModal` для конкретной активности
2. `useActivityReports` hook загружает черновики и отчеты через `GET /api/reports`
3. Черновики/отчеты отображаются в модальном окне
4. При сохранении `PUT /api/reports/:activityId` или `PUT /api/report-drafts/:activityId`

### Командная сводка

1. Руководитель переходит на вкладку "Личный кабинет" в `PersonalCabinet`
2. `useActivityReports` загружает сводку через `GET /api/team/summary`
3. Отображается список подчиненных с метриками активностей/отчетов
4. При выборе сотрудника `employeeUserId` фильтрует данные

## Типовые задачи

### Добавить новый endpoint

1. Добавить обработчик в `server/index.js`
2. Если нужна работа с БД, добавить функцию в соответствующий `*Repository.js`
3. Вызвать из frontend через `src/services/*Api.js`
4. Протестировать через smoke-test или manual testing

### Изменить схему БД

1. Создать новый файл миграции в `server/migrations/` (следующий номер)
2. Написать SQL
3. Запустить `npm run db:migrate`
4. Обновить типы/функции в `*Repository.js` если нужно

### Обновить CSS без нарушения UI

1. Прочитать [css-visual-baseline.md](css-visual-baseline.md)
2. Изменить только token-слой в `App.css` или `PersonalCabinet.css`
3. Запустить `npm run build`
4. Проверить календарь, кабинет, модальные окна по чек-листу
5. Удалять legacy-блоки только если новый слой их уже заменил

## Отладка

### Frontend не видит API

- Проверить `VITE_API_URL` в `.env.local`
- Проверить, что backend запущен на нужном порту
- Проверить CORS в `server/index.js`

### БД не подключается

- Проверить `DATABASE_URL` формат: `postgresql://user:password@host:port/database?sslmode=require`
- Проверить, что PostgreSQL доступна из сети
- Запустить `npm run db:migrate` для инициализации схемы

### Smoke-тест API падает

- Проверить логин/пароль в `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD`
- Проверить, что пользователь существует в БД
- Смотреть логи backend: `npm run api:dev`
- Подробнее в [api-smoke-test.md](api-smoke-test.md)

## Ссылки

- Основной репозиторий: корень проекта
- Issues/PRs: GitHub
- Wiki: документация в папке `docs/`

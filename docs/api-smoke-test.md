# API Smoke Test

Документ описывает быстрый сквозной тест backend API с авторизацией.

Скрипт: `scripts/api-smoke-test.ps1`

## Что проверяет smoke test

Сценарий выполняет полный жизненный цикл:

1. Логин через `POST /auth/login`
2. Создание активности (`POST /activities`)
3. Проверка, что активность доступна в списке (`GET /activities`)
4. Сохранение черновика отчета (`PUT /report-drafts/:activityId`)
5. Проверка наличия черновика через `GET /reports`
6. Обновление активности (`PUT /activities/:id`)
7. Сохранение финального отчета (`PUT /reports/:activityId`)
8. Удаление черновика (`DELETE /report-drafts/:activityId`)
9. Проверка состояния отчетов/черновиков через `GET /reports`
10. Удаление активности (`DELETE /activities/:id`)
11. Финальная проверка, что активность удалена из списка

При успехе выводится:

```text
API_AUTH_FLOW_SMOKE: PASS
```

При ошибке:

```text
API_AUTH_FLOW_SMOKE: FAIL
```

или

```text
API_AUTH_FLOW_SMOKE_ERROR: <message>
```

## Предварительные условия

1. Подняты backend и БД:

```powershell
npm run db:migrate
npm run api:dev
```

2. В `.env.local` (или переменных окружения) заданы:

```env
VITE_API_URL=http://localhost:8787/api
SMOKE_TEST_EMAIL=user@example.com
SMOKE_TEST_PASSWORD=your_password
```

`VITE_API_URL` должен указывать на API с префиксом `/api`.

## Запуск

Из корня проекта:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api-smoke-test.ps1
```

## Разбор типовых проблем

- `VITE_API_URL was not found...`
  - Добавьте `VITE_API_URL` в `.env.local` или в переменные окружения.

- `Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD...`
  - Укажите тестовые учетные данные пользователя, который существует в таблице пользователей.

- `Login succeeded but token is missing.`
  - Проверьте корректность auth API и соответствие формата ответа backend.

- Ошибки 401/403 на операциях с активностями:
  - Убедитесь, что пользователь имеет права на назначение `employeeUserId`/`person` согласно серверной политике доступа.

- Ошибки подключения:
  - Проверьте, что backend запущен, порт совпадает с `VITE_API_URL`, а PostgreSQL доступен по `DATABASE_URL`.

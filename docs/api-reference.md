# API Reference

Полное описание backend API endpoint-ов с примерами запросов и ответов.

**Base URL:** `http://localhost:8787/api` (локально) или конфигурируется через `VITE_API_URL`.

## Содержание

- [Аутентификация](#аутентификация)
- [Активности](#активности)
- [Отчеты](#отчеты)
- [Публичные активности](#публичные-активности)
- [Команда](#команда)
- [Администрирование](#администрирование)
- [Health Check](#health-check)

---

## Аутентификация

### POST /api/auth/login

Вход в систему по email и пароль.

**Request:**

```bash
POST http://localhost:8787/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "session": {
    "user": {
      "id": "user-id-123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "employee"
    },
    "issuedAt": "2026-04-24T10:30:00Z",
    "expiresAt": "2026-04-25T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (401):**

```json
{
  "success": false,
  "error": "Неверный email или пароль."
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Email и пароль обязательны."
}
```

---

### GET /api/auth/session

Получить текущую сессию (требует авторизации).

**Request:**

```bash
GET http://localhost:8787/api/auth/session
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "session": {
    "user": {
      "id": "user-id-123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "employee"
    },
    "issuedAt": "2026-04-24T10:30:00Z",
    "expiresAt": "2026-04-25T10:30:00Z"
  }
}
```

**Response (401):**

```json
{
  "success": false,
  "error": "Требуется авторизация."
}
```

---

### POST /api/auth/logout

Выход из системы (требует авторизации).

**Request:**

```bash
POST http://localhost:8787/api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true
}
```

**Response (401):**

```json
{
  "success": false,
  "error": "Требуется авторизация."
}
```

---

## Активности

### GET /api/activities

Получить список всех активностей (требует авторизации).

**Request:**

```bash
GET http://localhost:8787/api/activities
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "items": [
    {
      "id": "activity-1",
      "employeeUserId": "user-id-123",
      "date": "31.03.2026",
      "time": "13:10:00",
      "name": "Встреча с клиентом",
      "person": "John Doe",
      "objects": "Project Alpha",
      "eventType": "external",
      "visibility": "private"
    },
    {
      "id": "activity-2",
      "employeeUserId": "user-id-123",
      "date": "31.03.2026",
      "time": "14:30:00",
      "name": "Код-ревью",
      "person": "Jane Smith",
      "objects": "Backend, Frontend",
      "eventType": "internal",
      "visibility": "public"
    }
  ]
}
```

**Response (500):**

```json
{
  "success": false,
  "error": "Failed to load activities."
}
```

---

### POST /api/activities

Создать новую активность (требует авторизации и прав доступа).

**Request:**

```bash
POST http://localhost:8787/api/activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "activity": {
    "id": "activity-new-001",
    "employeeUserId": "user-id-123",
    "date": "25.04.2026",
    "time": "09:00",
    "name": "Планирование спринта",
    "person": "John Doe",
    "objects": "Planning",
    "eventType": "internal",
    "visibility": "private"
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "item": {
    "id": "activity-new-001",
    "employeeUserId": "user-id-123",
    "date": "25.04.2026",
    "time": "09:00:00",
    "name": "Планирование спринта",
    "person": "John Doe",
    "objects": "Planning",
    "eventType": "internal",
    "visibility": "private"
  }
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Activity id is required."
}
```

**Response (403):**

```json
{
  "success": false,
  "error": "Недостаточно прав."
}
```

**Notes:**

- `id` обязателен, может генерироваться как `"${prefix}-${timestamp}"`.
- `employeeUserId` должен быть доступен пользователю согласно политике доступа.
- `date` формат: `DD.MM.YYYY`.
- `time` формат: `HH:MM` (опционально).
- `eventType`: `"internal"` или `"external"`.
- `visibility`: `"public"` или `"private"`.

---

### PUT /api/activities/:id

Обновить активность (требует авторизации и прав доступа).

**Request:**

```bash
PUT http://localhost:8787/api/activities/activity-new-001
Authorization: Bearer <token>
Content-Type: application/json

{
  "activity": {
    "id": "activity-new-001",
    "employeeUserId": "user-id-123",
    "date": "25.04.2026",
    "time": "10:00",
    "name": "Планирование спринта (обновлено)",
    "person": "John Doe",
    "objects": "Planning, Design",
    "eventType": "internal",
    "visibility": "private"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "item": {
    "id": "activity-new-001",
    "employeeUserId": "user-id-123",
    "date": "25.04.2026",
    "time": "10:00:00",
    "name": "Планирование спринта (обновлено)",
    "person": "John Doe",
    "objects": "Planning, Design",
    "eventType": "internal",
    "visibility": "private"
  }
}
```

**Response (404):**

```json
{
  "success": false,
  "error": "Activity not found."
}
```

---

### DELETE /api/activities/:id

Удалить активность (требует авторизации).

**Request:**

```bash
DELETE http://localhost:8787/api/activities/activity-new-001
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true
}
```

**Response (404):**

```json
{
  "success": false,
  "error": "Activity not found."
}
```

---

## Отчеты

### GET /api/reports

Получить все отчеты и черновики (требует авторизации).

**Request:**

```bash
GET http://localhost:8787/api/reports
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "reportsByActivityId": {
    "activity-1": {
      "date": "31.03.2026",
      "time": "13:10",
      "employeeName": "John Doe",
      "meetingContent": "Обсудили требования проекта",
      "meetingFormat": "video-call",
      "projects": ["Project Alpha"],
      "notificationsCount": "5",
      "telegramSubscriptionsCount": "2",
      "comment": "Все согласованно"
    }
  },
  "draftsByActivityId": {
    "activity-2": {
      "date": "31.03.2026",
      "time": "14:30",
      "employeeName": "Jane Smith",
      "meetingContent": "Черновик контента",
      "meetingFormat": "in-person",
      "projects": ["Backend"],
      "notificationsCount": "3",
      "telegramSubscriptionsCount": "1",
      "comment": "Не завершено"
    }
  }
}
```

**Response (500):**

```json
{
  "success": false,
  "error": "Failed to load reports."
}
```

---

### PUT /api/reports/:activityId

Сохранить отчет по активности (требует авторизации).

**Request:**

```bash
PUT http://localhost:8787/api/reports/activity-1
Authorization: Bearer <token>
Content-Type: application/json

{
  "report": {
    "date": "31.03.2026",
    "time": "13:10",
    "employeeName": "John Doe",
    "meetingContent": "Обсудили требования проекта",
    "meetingFormat": "video-call",
    "projects": ["Project Alpha", "Project Beta"],
    "notificationsCount": "5",
    "telegramSubscriptionsCount": "2",
    "comment": "Все согласованно"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "item": {
    "date": "31.03.2026",
    "time": "13:10",
    "employeeName": "John Doe",
    "meetingContent": "Обсудили требования проекта",
    "meetingFormat": "video-call",
    "projects": ["Project Alpha", "Project Beta"],
    "notificationsCount": "5",
    "telegramSubscriptionsCount": "2",
    "comment": "Все согласованно"
  }
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Failed to save report."
}
```

---

### DELETE /api/reports/:activityId

Удалить отчет по активности (требует авторизации).

**Request:**

```bash
DELETE http://localhost:8787/api/reports/activity-1
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true
}
```

---

### PUT /api/report-drafts/:activityId

Сохранить черновик отчета (требует авторизации).

**Request:**

```bash
PUT http://localhost:8787/api/report-drafts/activity-2
Authorization: Bearer <token>
Content-Type: application/json

{
  "draft": {
    "date": "31.03.2026",
    "time": "14:30",
    "employeeName": "Jane Smith",
    "meetingContent": "Обсуждение архитектуры",
    "meetingFormat": "in-person",
    "projects": ["Backend"],
    "notificationsCount": "3",
    "telegramSubscriptionsCount": "1",
    "comment": "Продолжить завтра"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "item": {
    "date": "31.03.2026",
    "time": "14:30",
    "employeeName": "Jane Smith",
    "meetingContent": "Обсуждение архитектуры",
    "meetingFormat": "in-person",
    "projects": ["Backend"],
    "notificationsCount": "3",
    "telegramSubscriptionsCount": "1",
    "comment": "Продолжить завтра"
  }
}
```

---

### DELETE /api/report-drafts/:activityId

Удалить черновик отчета (требует авторизации).

**Request:**

```bash
DELETE http://localhost:8787/api/report-drafts/activity-2
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true
}
```

---

## Публичные активности

### GET /api/public/activities

Получить список публичных активностей (авторизация не требуется).

**Request:**

```bash
GET http://localhost:8787/api/public/activities
```

**Response (200):**

```json
{
  "success": true,
  "items": [
    {
      "id": "activity-2",
      "employeeUserId": "user-id-456",
      "date": "31.03.2026",
      "time": "14:30:00",
      "name": "Код-ревью",
      "person": "Jane Smith",
      "objects": "Backend, Frontend",
      "eventType": "internal",
      "visibility": "public"
    }
  ]
}
```

---

## Команда

### GET /api/team/users

Получить пользователей команды (требует авторизации с ролью: `line_manager`, `full_manager`, `administrator`).

**Request:**

```bash
GET http://localhost:8787/api/team/users
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "users": [
    {
      "id": "user-id-123",
      "email": "john@example.com",
      "displayName": "John Doe",
      "role": "employee"
    },
    {
      "id": "user-id-456",
      "email": "jane@example.com",
      "displayName": "Jane Smith",
      "role": "employee"
    }
  ]
}
```

**Response (403):**

```json
{
  "success": false,
  "error": "Недостаточно прав для просмотра сводки команды."
}
```

---

### GET /api/team/summary

Получить командную сводку активностей и отчетов (требует авторизации).

**Request:**

```bash
GET http://localhost:8787/api/team/summary?employeeUserId=user-id-123&startDate=2026-03-24&endDate=2026-04-24
Authorization: Bearer <token>
```

**Query Parameters:**

- `employeeUserId` (опционально) - фильтр по конкретному сотруднику
- `startDate` (опционально) - начало периода, формат ISO 8601 (`YYYY-MM-DD`)
- `endDate` (опционально) - конец периода, формат ISO 8601 (`YYYY-MM-DD`)

**Response (200):**

```json
{
  "success": true,
  "scope": {
    "filter": "user-id-123",
    "dateStart": "2026-03-24",
    "dateEnd": "2026-04-24"
  },
  "overview": {
    "totalActivities": 15,
    "totalReports": 10,
    "activeUsers": 1
  },
  "employees": [
    {
      "id": "user-id-123",
      "displayName": "John Doe",
      "email": "john@example.com",
      "activitiesCount": 15,
      "reportsCount": 10
    }
  ],
  "projects": [
    {
      "name": "Project Alpha",
      "count": 5
    },
    {
      "name": "Project Beta",
      "count": 3
    }
  ],
  "reports": [
    {
      "activityId": "activity-1",
      "employeeName": "John Doe",
      "date": "2026-03-31",
      "reportData": {
        "meetingContent": "...",
        "projects": ["Project Alpha"]
      }
    }
  ]
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Invalid date format."
}
```

**Response (403):**

```json
{
  "success": false,
  "error": "Недостаточно прав для просмотра сводки по выбранному сотруднику."
}
```

---

## Администрирование

### GET /api/admin/users

Получить всех пользователей (требует авторизации с ролью: `administrator`, `full_manager`).

**Request:**

```bash
GET http://localhost:8787/api/admin/users
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "users": [
    {
      "id": "user-id-123",
      "email": "john@example.com",
      "displayName": "John Doe",
      "role": "employee"
    },
    {
      "id": "user-id-456",
      "email": "jane@example.com",
      "displayName": "Jane Smith",
      "role": "line_manager"
    }
  ]
}
```

---

### GET /api/admin/hierarchy

Получить иерархию сотрудников (требует авторизации с ролью: `administrator`, `full_manager`).

**Request:**

```bash
GET http://localhost:8787/api/admin/hierarchy
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "links": [
    {
      "managerId": "user-id-456",
      "managerDisplayName": "Jane Smith",
      "employeeId": "user-id-123",
      "employeeDisplayName": "John Doe"
    }
  ]
}
```

---

### POST /api/admin/hierarchy

Назначить сотрудника руководителю (требует авторизации с ролью: `administrator`, `full_manager`).

**Request:**

```bash
POST http://localhost:8787/api/admin/hierarchy
Authorization: Bearer <token>
Content-Type: application/json

{
  "managerUserId": "user-id-456",
  "employeeUserId": "user-id-123"
}
```

**Response (201):**

```json
{
  "success": true
}
```

**Response (400):**

```json
{
  "success": false,
  "error": "Не удалось назначить сотрудника."
}
```

---

### POST /api/admin/hierarchy/bulk

Массовое назначение сотрудников (требует авторизации с ролью: `administrator`, `full_manager`).

**Request:**

```bash
POST http://localhost:8787/api/admin/hierarchy/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "managerUserId": "user-id-456",
  "employeeUserIds": ["user-id-123", "user-id-789", "user-id-101"]
}
```

**Response (201):**

```json
{
  "success": true
}
```

---

### DELETE /api/admin/hierarchy

Удалить связь сотрудника и руководителя (требует авторизации с ролью: `administrator`, `full_manager`).

**Request:**

```bash
DELETE http://localhost:8787/api/admin/hierarchy
Authorization: Bearer <token>
Content-Type: application/json

{
  "managerUserId": "user-id-456",
  "employeeUserId": "user-id-123"
}
```

**Response (200):**

```json
{
  "success": true
}
```

---

## Health Check

### GET /api/health

Проверка здоровья backend и подключения к БД (авторизация не требуется).

**Request:**

```bash
GET http://localhost:8787/api/health
```

**Response (200):**

```json
{
  "success": true,
  "status": "ok"
}
```

**Response (500):**

```json
{
  "success": false,
  "error": "Database connection failed."
}
```

---

## Общие замечания

### Авторизация

Для приватных endpoint-ов передавайте токен в заголовке:

```
Authorization: Bearer <token>
```

Токен получается при успешном логине через `POST /api/auth/login`.

### Роли и права

- `employee` - базовый сотрудник, видит только свои активности
- `line_manager` - руководитель, видит активности своих подчиненных + может ле просматривать сводку команды
- `full_manager` - расширенные права, может управлять иерархией и всеми отчетами
- `administrator` - полный доступ ко всем endpoint-ам и данным

### Форматы дат и времени

- Дата: `DD.MM.YYYY` (в теле запроса), `YYYY-MM-DD` (в query params)
- Время: `HH:MM` или `HH:MM:SS`
- Временные метки: ISO 8601 с часовым поясом

### Обработка ошибок

Все ошибки возвращают JSON с полями:

```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

Проверяйте HTTP статус-коды для различия между типами ошибок:

- `400` - ошибка валидации или логики
- `401` - требуется авторизация
- `403` - недостаточно прав
- `404` - ресурс не найден
- `500` - серверная ошибка

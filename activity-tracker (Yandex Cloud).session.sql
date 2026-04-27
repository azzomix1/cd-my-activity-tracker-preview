-- Быстрый просмотр пользователей
SELECT id, email, display_name, role, created_at
FROM app_users
ORDER BY created_at DESC;

-- Проверка сессий авторизации (последние 20)
SELECT user_id, expires_at, created_at
FROM auth_sessions
ORDER BY created_at DESC
LIMIT 20;

import cors from 'cors';
import express from 'express';
import {
  createActivity,
  deleteActivity,
  listActivities,
  listPublicActivities,
  updateActivity,
} from './lib/activitiesRepository.js';
import {
  assignDirectReportsBatch,
  assignDirectReport,
  createSessionForUser,
  deleteSessionByToken,
  findUserByEmail,
  getAuthSessionByToken,
  listHierarchyLinks,
  listUsersForTeamPanel,
  listUsersForAdminPanel,
  removeDirectReport,
  toSessionPayload,
  verifyPassword,
} from './lib/authRepository.js';
import { canAssignActivityPerson } from './lib/activityPersonAccess.js';
import {
  deleteActivityReport,
  deleteActivityReportDraft,
  getReportsSnapshot,
  upsertActivityReport,
  upsertActivityReportDraft,
} from './lib/reportsRepository.js';
import { getTeamSummary } from './lib/teamSummaryRepository.js';
import { pool } from './lib/db.js';
import { loadEnv } from './lib/loadEnv.js';

loadEnv();

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const configuredCorsOrigins = process.env.CORS_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = !configuredCorsOrigins || configuredCorsOrigins.length === 0
  ? true
  : (origin, callback) => {
      if (!origin || configuredCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    };

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

function readBearerToken(request) {
  const rawAuthorization = request.headers.authorization;

  if (!rawAuthorization || typeof rawAuthorization !== 'string') {
    return null;
  }

  const [scheme, token] = rawAuthorization.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

async function attachAuthSession(request, _response, next) {
  const token = readBearerToken(request);

  if (!token) {
    request.auth = null;
    request.authToken = null;
    next();
    return;
  }

  try {
    const sessionRow = await getAuthSessionByToken(token);

    if (!sessionRow) {
      request.auth = null;
      request.authToken = null;
      next();
      return;
    }

    request.auth = {
      userId: String(sessionRow.user_id),
      email: String(sessionRow.email || ''),
      role: String(sessionRow.role || 'administrator'),
      displayName: String(sessionRow.display_name || ''),
      issuedAt: sessionRow.issued_at,
      expiresAt: sessionRow.expires_at,
    };
    request.authToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(request, response, next) {
  if (!request.auth) {
    response.status(401).json({ success: false, error: 'Требуется авторизация.' });
    return;
  }

  next();
}

function requireHierarchyAdmin(request, response, next) {
  if (!request.auth) {
    response.status(401).json({ success: false, error: 'Требуется авторизация.' });
    return;
  }

  const role = String(request.auth.role || '').trim().toLowerCase();
  const allowed = role === 'administrator' || role === 'full_manager';

  if (!allowed) {
    response.status(403).json({ success: false, error: 'Недостаточно прав для управления иерархией.' });
    return;
  }

  next();
}

function requireTeamSummaryAccess(request, response, next) {
  if (!request.auth) {
    response.status(401).json({ success: false, error: 'Требуется авторизация.' });
    return;
  }

  const role = String(request.auth.role || '').trim().toLowerCase();
  const allowed = role === 'administrator' || role === 'full_manager' || role === 'line_manager';

  if (!allowed) {
    response.status(403).json({ success: false, error: 'Недостаточно прав для просмотра сводки команды.' });
    return;
  }

  next();
}

async function requirePersonAssignmentAccess(request, response, next) {
  if (!request.auth) {
    response.status(401).json({ success: false, error: 'Требуется авторизация.' });
    return;
  }

  try {
    const targetPerson = String(request.body?.activity?.person ?? '').trim();
    const targetEmployeeUserId = String(request.body?.activity?.employeeUserId ?? '').trim();
    const accessResult = await canAssignActivityPerson({
      auth: request.auth,
      targetEmployeeUserId,
      targetPerson,
    });

    if (!accessResult.allowed) {
      response.status(403).json({ success: false, error: accessResult.reason || 'Недостаточно прав.' });
      return;
    }

    next();
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось проверить права.' });
  }
}

app.use('/api', attachAuthSession);

app.post('/api/auth/login', async (request, response) => {
  const email = String(request.body?.email || '').trim().toLowerCase();
  const password = String(request.body?.password || '');

  if (!email || !password) {
    response.status(400).json({ success: false, error: 'Email и пароль обязательны.' });
    return;
  }

  try {
    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      response.status(401).json({ success: false, error: 'Неверный email или пароль.' });
      return;
    }

    const issuedSession = await createSessionForUser(user.id);
    const sessionPayload = toSessionPayload({
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      issued_at: issuedSession.issuedAt,
      expires_at: issuedSession.expiresAt,
    });

    response.json({
      success: true,
      session: sessionPayload,
      token: issuedSession.token,
    });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось выполнить вход.' });
  }
});

app.get('/api/auth/session', requireAuth, async (request, response) => {
  try {
    const sessionPayload = toSessionPayload({
      user_id: request.auth.userId,
      email: request.auth.email,
      display_name: request.auth.displayName,
      role: request.auth.role,
      issued_at: request.auth.issuedAt,
      expires_at: request.auth.expiresAt,
    }, 'token');

    response.json({ success: true, session: sessionPayload });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось получить сессию.' });
  }
});

app.post('/api/auth/logout', requireAuth, async (request, response) => {
  try {
    await deleteSessionByToken(request.authToken);
    response.json({ success: true });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось завершить сессию.' });
  }
});

app.get('/api/admin/users', requireAuth, requireHierarchyAdmin, async (_request, response) => {
  try {
    const users = await listUsersForAdminPanel();
    response.json({ success: true, users });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось загрузить пользователей.' });
  }
});

app.get('/api/team/users', requireAuth, requireTeamSummaryAccess, async (request, response) => {
  try {
    const users = await listUsersForTeamPanel({
      role: request.auth.role,
      userId: request.auth.userId,
    });

    response.json({ success: true, users });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось загрузить сотрудников для обзора.' });
  }
});

app.get('/api/team/summary', requireAuth, requireTeamSummaryAccess, async (request, response) => {
  try {
    const accessibleUsers = await listUsersForTeamPanel({
      role: request.auth.role,
      userId: request.auth.userId,
    });
    const requestedEmployeeUserId = String(request.query?.employeeUserId || '').trim();

    if (requestedEmployeeUserId && !accessibleUsers.some((user) => user.id === requestedEmployeeUserId)) {
      response.status(403).json({ success: false, error: 'Недостаточно прав для просмотра сводки по выбранному сотруднику.' });
      return;
    }

    const scopedUsers = requestedEmployeeUserId
      ? accessibleUsers.filter((user) => user.id === requestedEmployeeUserId)
      : accessibleUsers;

    const summary = await getTeamSummary({
      employees: scopedUsers,
      startDate: request.query?.startDate,
      endDate: request.query?.endDate,
    });

    response.json({
      success: true,
      scope: summary.scope || {},
      overview: summary.overview || {},
      employees: Array.isArray(summary.employees) ? summary.employees : [],
      projects: Array.isArray(summary.projects) ? summary.projects : [],
      reports: Array.isArray(summary.reports) ? summary.reports : [],
    });
  } catch (error) {
    const status = /format|less than or equal/i.test(String(error.message || '')) ? 400 : 500;
    response.status(status).json({ success: false, error: error.message || 'Не удалось загрузить сводку команды.' });
  }
});

app.get('/api/admin/hierarchy', requireAuth, requireHierarchyAdmin, async (_request, response) => {
  try {
    const links = await listHierarchyLinks();
    response.json({ success: true, links });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Не удалось загрузить иерархию.' });
  }
});

app.post('/api/admin/hierarchy', requireAuth, requireHierarchyAdmin, async (request, response) => {
  try {
    await assignDirectReport(
      request.body?.managerUserId,
      request.body?.employeeUserId,
    );

    response.status(201).json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Не удалось назначить сотрудника.' });
  }
});

app.post('/api/admin/hierarchy/bulk', requireAuth, requireHierarchyAdmin, async (request, response) => {
  try {
    await assignDirectReportsBatch(
      request.body?.managerUserId,
      request.body?.employeeUserIds,
    );

    response.status(201).json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Не удалось назначить сотрудников.' });
  }
});

app.delete('/api/admin/hierarchy', requireAuth, requireHierarchyAdmin, async (request, response) => {
  try {
    await removeDirectReport(
      request.body?.managerUserId,
      request.body?.employeeUserId,
    );

    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Не удалось удалить связь.' });
  }
});

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('select 1');
    response.json({ success: true, status: 'ok' });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Database connection failed.' });
  }
});

app.get('/api/public/activities', async (_request, response) => {
  try {
    const items = await listPublicActivities();
    response.json({ success: true, items });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Failed to load public activities.' });
  }
});

app.get('/api/activities', requireAuth, async (_request, response) => {
  try {
    const items = await listActivities();
    response.json({ success: true, items });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Failed to load activities.' });
  }
});

app.post('/api/activities', requireAuth, requirePersonAssignmentAccess, async (request, response) => {
  try {
    const item = await createActivity(request.body?.activity || {});
    response.status(201).json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to create activity.' });
  }
});

app.put('/api/activities/:id', requireAuth, requirePersonAssignmentAccess, async (request, response) => {
  try {
    const item = await updateActivity(request.params.id, request.body?.activity || {});
    response.json({ success: true, item });
  } catch (error) {
    const status = error.message === 'Activity not found.' ? 404 : 400;
    response.status(status).json({ success: false, error: error.message || 'Failed to update activity.' });
  }
});

app.delete('/api/activities/:id', requireAuth, async (request, response) => {
  try {
    await deleteActivity(request.params.id);
    response.json({ success: true });
  } catch (error) {
    const status = error.message === 'Activity not found.' ? 404 : 400;
    response.status(status).json({ success: false, error: error.message || 'Failed to delete activity.' });
  }
});

app.get('/api/reports', requireAuth, async (_request, response) => {
  try {
    const snapshot = await getReportsSnapshot();
    response.json({ success: true, ...snapshot });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Failed to load reports.' });
  }
});

app.put('/api/reports/:activityId', requireAuth, async (request, response) => {
  try {
    const item = await upsertActivityReport(request.params.activityId, request.body?.report || {});
    response.json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to save report.' });
  }
});

app.delete('/api/reports/:activityId', requireAuth, async (request, response) => {
  try {
    await deleteActivityReport(request.params.activityId);
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to delete report.' });
  }
});

app.put('/api/report-drafts/:activityId', requireAuth, async (request, response) => {
  try {
    const item = await upsertActivityReportDraft(request.params.activityId, request.body?.draft || {});
    response.json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to save report draft.' });
  }
});

app.delete('/api/report-drafts/:activityId', requireAuth, async (request, response) => {
  try {
    await deleteActivityReportDraft(request.params.activityId);
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to delete report draft.' });
  }
});

app.listen(port, () => {
  console.log(`PostgreSQL API listening on http://localhost:${port}`);
});
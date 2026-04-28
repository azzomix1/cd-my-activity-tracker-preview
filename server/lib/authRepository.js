import crypto from 'node:crypto';
import { query } from './db.js';

const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_HOURS = Number(process.env.AUTH_SESSION_TTL_HOURS || 12);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
}

export function buildPasswordHash(password) {
  const normalizedPassword = String(password || '');

  if (!normalizedPassword) {
    throw new Error('Password is required.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const digest = hashPassword(normalizedPassword, salt);
  return `${salt}:${digest}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const [salt, digest] = storedHash.split(':');

  if (!salt || !digest) {
    return false;
  }

  const candidateDigest = hashPassword(String(password || ''), salt);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateDigest, 'hex'),
      Buffer.from(digest, 'hex'),
    );
  } catch {
    return false;
  }
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const result = await query(
    `
      select id, email, password_hash, display_name, role
      from app_users
      where email = $1 and is_active = true
      limit 1
    `,
    [normalizedEmail],
  );

  return result.rows[0] || null;
}

export async function createUser({ email, password, displayName = '', role = 'employee' }) {
  const normalizedEmail = normalizeEmail(email);
  const rawRole = String(role || '').trim().toLowerCase();
  const normalizedRole = rawRole === 'administrator'
    || rawRole === 'line_manager'
    || rawRole === 'full_manager'
    || rawRole === 'employee'
      ? rawRole
      : rawRole === 'admin'
        ? 'administrator'
        : rawRole === 'manager'
          ? 'full_manager'
          : 'employee';
  const passwordHash = buildPasswordHash(password);

  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  const result = await query(
    `
      insert into app_users (
        id,
        email,
        password_hash,
        display_name,
        role
      ) values ($1, $2, $3, $4, $5)
      returning id, email, display_name, role
    `,
    [
      crypto.randomUUID(),
      normalizedEmail,
      passwordHash,
      String(displayName || '').trim(),
      normalizedRole,
    ],
  );

  return result.rows[0] || null;
}

export async function createSessionForUser(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await query(
    `
      insert into auth_sessions (
        token,
        user_id,
        issued_at,
        expires_at
      ) values ($1, $2, $3, $4)
    `,
    [token, String(userId), issuedAt.toISOString(), expiresAt.toISOString()],
  );

  return {
    token,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAuthSessionByToken(token) {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    return null;
  }

  const result = await query(
    `
      select
        s.token,
        s.issued_at,
        s.expires_at,
        u.id as user_id,
        u.email,
        u.display_name,
        u.role
      from auth_sessions s
      join app_users u on u.id = s.user_id
      where s.token = $1
        and s.expires_at > now()
        and u.is_active = true
      limit 1
    `,
    [normalizedToken],
  );

  if (!result.rows[0]) {
    await deleteSessionByToken(normalizedToken);
    return null;
  }

  return result.rows[0];
}

export async function deleteSessionByToken(token) {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    return;
  }

  await query('delete from auth_sessions where token = $1', [normalizedToken]);
}

export async function listUsersForAdminPanel() {
  const result = await query(
    `
      select
        id,
        email,
        display_name,
        role,
        is_active
      from app_users
      where is_active = true
      order by role asc, display_name asc, email asc
    `,
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    email: String(row.email || ''),
    displayName: String(row.display_name || ''),
    role: mapRoleToAuthRole(row.role),
    isActive: Boolean(row.is_active),
  }));
}

export async function listUsersForTeamPanel({ role, userId }) {
  const normalizedRole = mapRoleToAuthRole(role);
  const normalizedUserId = String(userId || '').trim();

  if (normalizedRole === 'administrator') {
    const result = await query(
      `
        select
          id,
          email,
          display_name,
          role,
          is_active
        from app_users
        where is_active = true
        order by display_name asc, email asc
      `,
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      role: mapRoleToAuthRole(row.role),
      isActive: Boolean(row.is_active),
    }));
  }

  if (normalizedRole === 'full_manager') {
    const result = await query(
      `
        select
          id,
          email,
          display_name,
          role,
          is_active
        from app_users
        where is_active = true
          and role in ('employee', 'line_manager')
        order by display_name asc, email asc
      `,
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      role: mapRoleToAuthRole(row.role),
      isActive: Boolean(row.is_active),
    }));
  }

  if (normalizedRole === 'line_manager') {
    const result = await query(
      `
        select
          u.id,
          u.email,
          u.display_name,
          u.role,
          u.is_active
        from user_hierarchy h
        join app_users u on u.id = h.employee_user_id
        where h.manager_user_id = $1
          and u.is_active = true
          and u.role = 'employee'
        order by u.display_name asc, u.email asc
      `,
      [normalizedUserId],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      role: mapRoleToAuthRole(row.role),
      isActive: Boolean(row.is_active),
    }));
  }

  return [];
}

export async function listHierarchyLinks() {
  const result = await query(
    `
      select
        h.manager_user_id,
        h.employee_user_id,
        h.created_at,
        manager.email as manager_email,
        manager.display_name as manager_display_name,
        manager.role as manager_role,
        employee.email as employee_email,
        employee.display_name as employee_display_name,
        employee.role as employee_role
      from user_hierarchy h
      join app_users manager on manager.id = h.manager_user_id
      join app_users employee on employee.id = h.employee_user_id
      where manager.is_active = true
        and employee.is_active = true
      order by manager.display_name asc, manager.email asc, employee.display_name asc, employee.email asc
    `,
  );

  return result.rows.map((row) => ({
    managerUserId: String(row.manager_user_id),
    employeeUserId: String(row.employee_user_id),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    manager: {
      email: String(row.manager_email || ''),
      displayName: String(row.manager_display_name || ''),
      role: mapRoleToAuthRole(row.manager_role),
    },
    employee: {
      email: String(row.employee_email || ''),
      displayName: String(row.employee_display_name || ''),
      role: mapRoleToAuthRole(row.employee_role),
    },
  }));
}

async function findUserById(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const result = await query(
    `
      select id, email, display_name, role, is_active
      from app_users
      where id = $1
      limit 1
    `,
    [normalizedUserId],
  );

  return result.rows[0] || null;
}

function validateHierarchyRoles(managerRole, employeeRole) {
  if (mapRoleToAuthRole(managerRole) !== 'line_manager') {
    throw new Error('Руководителем в связке может быть только пользователь с ролью Линейный руководитель.');
  }

  if (mapRoleToAuthRole(employeeRole) !== 'employee') {
    throw new Error('Подчиненным в связке может быть только пользователь с ролью Сотрудник.');
  }
}

export async function assignDirectReport(managerUserId, employeeUserId) {
  const normalizedManagerUserId = String(managerUserId || '').trim();
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();

  if (!normalizedManagerUserId || !normalizedEmployeeUserId) {
    throw new Error('Manager and employee are required.');
  }

  if (normalizedManagerUserId === normalizedEmployeeUserId) {
    throw new Error('Руководитель и сотрудник должны быть разными пользователями.');
  }

  const [manager, employee] = await Promise.all([
    findUserById(normalizedManagerUserId),
    findUserById(normalizedEmployeeUserId),
  ]);

  if (!manager || !manager.is_active) {
    throw new Error('Руководитель не найден или отключен.');
  }

  if (!employee || !employee.is_active) {
    throw new Error('Сотрудник не найден или отключен.');
  }

  validateHierarchyRoles(manager.role, employee.role);

  await query(
    `
      insert into user_hierarchy (manager_user_id, employee_user_id)
      values ($1, $2)
      on conflict (manager_user_id, employee_user_id) do nothing
    `,
    [normalizedManagerUserId, normalizedEmployeeUserId],
  );
}

export async function assignDirectReportsBatch(managerUserId, employeeUserIds) {
  const normalizedManagerUserId = String(managerUserId || '').trim();
  const normalizedEmployeeUserIds = Array.isArray(employeeUserIds)
    ? [...new Set(employeeUserIds.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];

  if (!normalizedManagerUserId) {
    throw new Error('Manager is required.');
  }

  if (normalizedEmployeeUserIds.length === 0) {
    throw new Error('At least one employee is required.');
  }

  for (const employeeUserId of normalizedEmployeeUserIds) {
    await assignDirectReport(normalizedManagerUserId, employeeUserId);
  }
}

export async function removeDirectReport(managerUserId, employeeUserId) {
  const normalizedManagerUserId = String(managerUserId || '').trim();
  const normalizedEmployeeUserId = String(employeeUserId || '').trim();

  if (!normalizedManagerUserId || !normalizedEmployeeUserId) {
    throw new Error('Manager and employee are required.');
  }

  await query(
    `
      delete from user_hierarchy
      where manager_user_id = $1
        and employee_user_id = $2
    `,
    [normalizedManagerUserId, normalizedEmployeeUserId],
  );
}

export function mapRoleToAuthRole(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'administrator' || normalized === 'admin') {
    return 'administrator';
  }

  if (normalized === 'line_manager') {
    return 'line_manager';
  }

  if (normalized === 'full_manager' || normalized === 'manager') {
    return 'full_manager';
  }

  return 'employee';
}

export function toSessionPayload(sessionRow, source = 'password') {
  return {
    role: mapRoleToAuthRole(sessionRow.role),
    user: {
      id: String(sessionRow.user_id || sessionRow.id || ''),
      email: String(sessionRow.email || ''),
      displayName: String(sessionRow.display_name || ''),
    },
    source,
    issuedAt: sessionRow.issued_at ? new Date(sessionRow.issued_at).toISOString() : null,
    expiresAt: sessionRow.expires_at ? new Date(sessionRow.expires_at).toISOString() : null,
  };
}
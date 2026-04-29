import { query } from './db.js';

function normalizeValue(value) {
  return String(value || '').trim();
}

function normalizeForComparison(value) {
  return normalizeValue(value).toLowerCase();
}

function getEmailLocalPart(email) {
  const normalizedEmail = normalizeValue(email).toLowerCase();
  const atIndex = normalizedEmail.indexOf('@');

  if (atIndex <= 0) {
    return '';
  }

  return normalizedEmail.slice(0, atIndex);
}

function buildUserAliases(user) {
  const aliases = new Set();
  const displayName = normalizeValue(user.displayName || user.display_name);
  const email = normalizeValue(user.email);
  const emailLocalPart = getEmailLocalPart(email);

  if (displayName) {
    aliases.add(normalizeForComparison(displayName));
  }

  if (email) {
    aliases.add(normalizeForComparison(email));
  }

  if (emailLocalPart) {
    aliases.add(normalizeForComparison(emailLocalPart));
  }

  return aliases;
}

async function listDirectReports(managerUserId) {
  const result = await query(
    `
      select u.id, u.email, u.display_name
      from user_hierarchy h
      join app_users u on u.id = h.employee_user_id
      where h.manager_user_id = $1
        and u.is_active = true
      order by u.display_name asc, u.email asc
    `,
    [String(managerUserId)],
  );

  return result.rows;
}

function isPrivilegedRole(role) {
  return role === 'administrator' || role === 'full_manager';
}

function isSupportSalesRole(role) {
  return role === 'support_sales_head' || role === 'support_sales_manager';
}

/**
 * Проверяет право пользователя указывать поле `person` при создании/редактировании активности.
 *
 * Правила:
 * - employee: только свое имя/почта или пустое значение
 * - line_manager: свои + сотрудники из иерархии + пустое значение
 * - full_manager/administrator: любое значение
 */
export async function canAssignActivityPerson({ auth, targetEmployeeUserId, targetPerson, targetEmployeeUserIds = [], targetPersons = [] }) {
  const normalizedRole = normalizeForComparison(auth?.role);
  const normalizedTarget = normalizeForComparison(targetPerson);
  const normalizedTargetEmployeeUserId = normalizeValue(targetEmployeeUserId);
  const normalizedTargetEmployeeUserIds = Array.isArray(targetEmployeeUserIds)
    ? targetEmployeeUserIds.map((item) => normalizeValue(item)).filter(Boolean)
    : [];
  const normalizedTargetPersons = Array.isArray(targetPersons)
    ? targetPersons.map((item) => normalizeForComparison(item)).filter(Boolean)
    : [];

  const targetDefined = Boolean(
    normalizedTarget
    || normalizedTargetEmployeeUserId
    || normalizedTargetEmployeeUserIds.length > 0
    || normalizedTargetPersons.length > 0
  );

  if (!targetDefined) {
    return { allowed: true };
  }

  if (isPrivilegedRole(normalizedRole)) {
    return { allowed: true };
  }

  if (normalizedRole === 'employee') {
    const requestedIds = normalizedTargetEmployeeUserIds.length > 0
      ? normalizedTargetEmployeeUserIds
      : (normalizedTargetEmployeeUserId ? [normalizedTargetEmployeeUserId] : []);
    if (requestedIds.length > 0) {
      const ownUserId = String(auth?.userId || '').trim();
      const allowedByIds = requestedIds.every((item) => item === ownUserId);

      return {
        allowed: allowedByIds,
        reason: allowedByIds
          ? ''
          : 'Сотрудник может назначать мероприятие только на себя или без сотрудника.',
      };
    }

    const requestedPersons = normalizedTargetPersons.length > 0
      ? normalizedTargetPersons
      : (normalizedTarget ? [normalizedTarget] : []);

    if (normalizedTargetEmployeeUserId) {
      const allowedById = normalizedTargetEmployeeUserId === String(auth?.userId || '').trim();

      return {
        allowed: allowedById,
        reason: allowedById
          ? ''
          : 'Сотрудник может назначать мероприятие только на себя или без сотрудника.',
      };
    }

    const ownAliases = buildUserAliases(auth);
    const allowed = requestedPersons.every((item) => ownAliases.has(item));

    return {
      allowed,
      reason: allowed
        ? ''
        : 'Сотрудник может назначать мероприятие только на себя или без сотрудника.',
    };
  }

  if (normalizedRole === 'support_sales_manager') {
    const requestedIds = normalizedTargetEmployeeUserIds.length > 0
      ? normalizedTargetEmployeeUserIds
      : (normalizedTargetEmployeeUserId ? [normalizedTargetEmployeeUserId] : []);
    const ownUserId = String(auth?.userId || '').trim();

    if (requestedIds.length > 0) {
      const allowedByIds = requestedIds.every((item) => item === ownUserId);

      return {
        allowed: allowedByIds,
        reason: allowedByIds
          ? ''
          : 'Менеджер корпоративных продаж может назначать мероприятие только на себя или без сотрудника.',
      };
    }

    const requestedPersons = normalizedTargetPersons.length > 0
      ? normalizedTargetPersons
      : (normalizedTarget ? [normalizedTarget] : []);
    const ownAliases = buildUserAliases(auth);
    const allowed = requestedPersons.every((item) => ownAliases.has(item));

    return {
      allowed,
      reason: allowed
        ? ''
        : 'Менеджер корпоративных продаж может назначать мероприятие только на себя или без сотрудника.',
    };
  }

  if (normalizedRole === 'support_sales_head') {
    const ownUserId = String(auth?.userId || '').trim();
    const supportManagersResult = await query(
      `
        select id, email, display_name
        from app_users
        where is_active = true
          and role = 'support_sales_manager'
      `,
    );
    const supportManagerIds = new Set(supportManagersResult.rows.map((row) => String(row.id || '').trim()).filter(Boolean));

    const requestedIds = normalizedTargetEmployeeUserIds.length > 0
      ? normalizedTargetEmployeeUserIds
      : (normalizedTargetEmployeeUserId ? [normalizedTargetEmployeeUserId] : []);

    if (requestedIds.length > 0) {
      const allowedByIds = requestedIds.every((item) => item === ownUserId || supportManagerIds.has(item));

      return {
        allowed: allowedByIds,
        reason: allowedByIds
          ? ''
          : 'Руководитель поддержки корпоративных продаж может назначать мероприятие только себе, менеджерам отдела или без сотрудника.',
      };
    }

    const availableAliases = new Set();
    buildUserAliases(auth).forEach((alias) => availableAliases.add(alias));
    supportManagersResult.rows.forEach((row) => {
      buildUserAliases(row).forEach((alias) => availableAliases.add(alias));
    });

    const requestedPersons = normalizedTargetPersons.length > 0
      ? normalizedTargetPersons
      : (normalizedTarget ? [normalizedTarget] : []);
    const allowed = requestedPersons.every((item) => availableAliases.has(item));

    return {
      allowed,
      reason: allowed
        ? ''
        : 'Руководитель поддержки корпоративных продаж может назначать мероприятие только себе, менеджерам отдела или без сотрудника.',
    };
  }

  if (isSupportSalesRole(normalizedRole)) {
    return {
      allowed: false,
      reason: 'Недостаточно прав для назначения сотрудника в мероприятии.',
    };
  }

  if (normalizedRole === 'line_manager') {
    const ownAliases = buildUserAliases(auth);
    const directReports = await listDirectReports(auth.userId);
    const directReportIds = new Set(directReports.map((employee) => String(employee.id)));

    const requestedIds = normalizedTargetEmployeeUserIds.length > 0
      ? normalizedTargetEmployeeUserIds
      : (normalizedTargetEmployeeUserId ? [normalizedTargetEmployeeUserId] : []);

    if (requestedIds.length > 0) {
      const ownUserId = String(auth?.userId || '').trim();
      const allowedByIds = requestedIds.every((item) => item === ownUserId || directReportIds.has(item));

      return {
        allowed: allowedByIds,
        reason: allowedByIds
          ? ''
          : 'Линейный руководитель может назначать мероприятие только себе, своим сотрудникам или без сотрудника.',
      };
    }

    if (normalizedTargetEmployeeUserId) {
      const ownUserId = String(auth?.userId || '').trim();
      const allowedById = normalizedTargetEmployeeUserId === ownUserId || directReportIds.has(normalizedTargetEmployeeUserId);

      return {
        allowed: allowedById,
        reason: allowedById
          ? ''
          : 'Линейный руководитель может назначать мероприятие только себе, своим сотрудникам или без сотрудника.',
      };
    }

    const reportAliases = directReports.reduce((set, employee) => {
      buildUserAliases(employee).forEach((alias) => set.add(alias));
      return set;
    }, new Set());

    ownAliases.forEach((alias) => reportAliases.add(alias));

    const requestedPersons = normalizedTargetPersons.length > 0
      ? normalizedTargetPersons
      : (normalizedTarget ? [normalizedTarget] : []);
    const allowed = requestedPersons.every((item) => reportAliases.has(item));

    return {
      allowed,
      reason: allowed
        ? ''
        : 'Линейный руководитель может назначать мероприятие только себе, своим сотрудникам или без сотрудника.',
    };
  }

  return {
    allowed: false,
    reason: 'Недостаточно прав для назначения сотрудника в мероприятии.',
  };
}
export const AUTH_ROLES = {
  ANONYMOUS: 'anonymous',
  ADMINISTRATOR: 'administrator',
  EMPLOYEE: 'employee',
  LINE_MANAGER: 'line_manager',
  FULL_MANAGER: 'full_manager',
  SUPPORT_SALES_HEAD: 'support_sales_head',
  SUPPORT_SALES_MANAGER: 'support_sales_manager',
};

export const OPTIONAL_REPORT_ROLES = new Set([
  AUTH_ROLES.SUPPORT_SALES_HEAD,
  AUTH_ROLES.SUPPORT_SALES_MANAGER,
]);

export const ACTIVITY_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

export const ACCESS_ACTIONS = {
  VIEW_PUBLIC_CALENDAR: 'viewPublicCalendar',
  ACCESS_CABINET: 'accessCabinet',
  CREATE_ACTIVITY: 'createActivity',
  UPDATE_OWN_ACTIVITY: 'updateOwnActivity',
  DELETE_OWN_ACTIVITY: 'deleteOwnActivity',
  FILL_OWN_REPORT: 'fillOwnReport',
  VIEW_ALL_ACTIVITIES: 'viewAllActivities',
  MANAGE_ALL_ACTIVITIES: 'manageAllActivities',
};

export const ACCESS_MATRIX = {
  [AUTH_ROLES.ANONYMOUS]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: false,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: false,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: false,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: false,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: false,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: false,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: false,
  },
  [AUTH_ROLES.ADMINISTRATOR]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
  [AUTH_ROLES.EMPLOYEE]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
  [AUTH_ROLES.LINE_MANAGER]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
  [AUTH_ROLES.FULL_MANAGER]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
  [AUTH_ROLES.SUPPORT_SALES_HEAD]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
  [AUTH_ROLES.SUPPORT_SALES_MANAGER]: {
    [ACCESS_ACTIONS.VIEW_PUBLIC_CALENDAR]: true,
    [ACCESS_ACTIONS.ACCESS_CABINET]: true,
    [ACCESS_ACTIONS.CREATE_ACTIVITY]: true,
    [ACCESS_ACTIONS.UPDATE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.DELETE_OWN_ACTIVITY]: true,
    [ACCESS_ACTIONS.FILL_OWN_REPORT]: true,
    [ACCESS_ACTIONS.VIEW_ALL_ACTIVITIES]: true,
    [ACCESS_ACTIONS.MANAGE_ALL_ACTIVITIES]: true,
  },
};

export function isOptionalReportRole(role) {
  return OPTIONAL_REPORT_ROLES.has(String(role || '').trim());
}

export function canCreatePrivateActivities(role) {
  return !isOptionalReportRole(role);
}

/**
 * Возвращает права для роли. Для неизвестной роли применяется anonymous.
 *
 * @param {string} role
 * @returns {Record<string, boolean>}
 */
export function getAccessPolicy(role) {
  return ACCESS_MATRIX[role] || ACCESS_MATRIX[AUTH_ROLES.ANONYMOUS];
}

/**
 * Проверяет право роли на действие.
 *
 * @param {string} role
 * @param {string} action
 * @returns {boolean}
 */
export function hasAccess(role, action) {
  return Boolean(getAccessPolicy(role)[action]);
}

/**
 * Нормализует видимость активности к public/private.
 *
 * @param {import('../services/activitiesApi').Activity | { visibility?: string } | null | undefined} activity
 * @returns {'public'|'private'}
 */
export function getActivityVisibility(activity) {
  return activity?.visibility === ACTIVITY_VISIBILITY.PRIVATE
    ? ACTIVITY_VISIBILITY.PRIVATE
    : ACTIVITY_VISIBILITY.PUBLIC;
}

/**
 * Возвращает true, если активность публичная.
 *
 * @param {import('../services/activitiesApi').Activity | { visibility?: string } | null | undefined} activity
 * @returns {boolean}
 */
export function isPublicActivity(activity) {
  return getActivityVisibility(activity) === ACTIVITY_VISIBILITY.PUBLIC;
}

/**
 * Возвращает true, если активность личная.
 *
 * @param {import('../services/activitiesApi').Activity | { visibility?: string } | null | undefined} activity
 * @returns {boolean}
 */
export function isPrivateActivity(activity) {
  return getActivityVisibility(activity) === ACTIVITY_VISIBILITY.PRIVATE;
}

/**
 * Человекочитаемая подпись аудитории активности.
 *
 * @param {import('../services/activitiesApi').Activity | { visibility?: string } | null | undefined} activity
 * @returns {'публичное'|'личное'}
 */
export function getActivityAudienceLabel(activity) {
  return isPrivateActivity(activity) ? 'личное' : 'публичное';
}
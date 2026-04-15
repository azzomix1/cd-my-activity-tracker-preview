import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_ROLES, getAccessPolicy } from './accessPolicy';

const SESSION_STORAGE_KEY = 'activity-tracker-session';

export const SESSION_STATUSES = {
  LOADING: 'loading',
  ANONYMOUS: 'anonymous',
  AUTHENTICATED: 'authenticated',
};

const AuthSessionContext = createContext(null);

function buildAnonymousSession() {
  return {
    role: AUTH_ROLES.ANONYMOUS,
    user: null,
    source: 'bootstrap',
    issuedAt: null,
    expiresAt: null,
  };
}

function normalizeSession(rawSession) {
  if (!rawSession || typeof rawSession !== 'object') {
    return buildAnonymousSession();
  }

  const normalizedRole = Object.values(AUTH_ROLES).includes(rawSession.role)
    ? rawSession.role
    : AUTH_ROLES.ANONYMOUS;

  const normalizedUser = rawSession.user && typeof rawSession.user === 'object'
    ? {
        id: rawSession.user.id ? String(rawSession.user.id) : '',
        email: rawSession.user.email ? String(rawSession.user.email) : '',
        displayName: rawSession.user.displayName ? String(rawSession.user.displayName) : '',
      }
    : null;

  if (normalizedRole === AUTH_ROLES.ANONYMOUS || !normalizedUser) {
    return buildAnonymousSession();
  }

  return {
    role: normalizedRole,
    user: normalizedUser,
    source: rawSession.source ? String(rawSession.source) : 'local',
    issuedAt: rawSession.issuedAt ? String(rawSession.issuedAt) : null,
    expiresAt: rawSession.expiresAt ? String(rawSession.expiresAt) : null,
  };
}

function readStoredSession() {
  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawValue) {
      return buildAnonymousSession();
    }

    return normalizeSession(JSON.parse(rawValue));
  } catch {
    return buildAnonymousSession();
  }
}

/**
 * Провайдер фронтового состояния сессии.
 * Пока используется как каркас для будущей интеграции с БД и backend auth,
 * без влияния на текущий UX приложения.
 *
 * @param {{ children: import('react').ReactNode }} props
 * @returns {JSX.Element}
 */
export function AuthSessionProvider({ children }) {
  const [session, setSessionState] = useState(buildAnonymousSession);
  const [sessionStatus, setSessionStatus] = useState(SESSION_STATUSES.LOADING);

  useEffect(() => {
    let isMounted = true;

    Promise.resolve(readStoredSession()).then((storedSession) => {
      if (!isMounted) {
        return;
      }

      setSessionState(storedSession);
      setSessionStatus(
        storedSession.user
          ? SESSION_STATUSES.AUTHENTICATED
          : SESSION_STATUSES.ANONYMOUS,
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === SESSION_STATUSES.LOADING) {
      return;
    }

    if (!session.user) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session, sessionStatus]);

  const setSession = useCallback((nextSession) => {
    const normalizedSession = normalizeSession(nextSession);

    setSessionState(normalizedSession);
    setSessionStatus(
      normalizedSession.user
        ? SESSION_STATUSES.AUTHENTICATED
        : SESSION_STATUSES.ANONYMOUS,
    );
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(buildAnonymousSession());
    setSessionStatus(SESSION_STATUSES.ANONYMOUS);
  }, []);

  const value = useMemo(() => ({
    session,
    sessionStatus,
    isAuthenticated: sessionStatus === SESSION_STATUSES.AUTHENTICATED,
    permissions: getAccessPolicy(session.role),
    setSession,
    clearSession,
  }), [clearSession, session, sessionStatus, setSession]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

/**
 * Возвращает текущее состояние сессии приложения.
 *
 * @returns {{
 *  session: { role: string, user: { id: string, email: string, displayName: string } | null, source: string, issuedAt: string | null, expiresAt: string | null },
 *  sessionStatus: 'loading'|'anonymous'|'authenticated',
 *  isAuthenticated: boolean,
 *  permissions: Record<string, boolean>,
 *  setSession: (session: unknown) => void,
 *  clearSession: () => void,
 * }}
 */
export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider.');
  }

  return context;
}
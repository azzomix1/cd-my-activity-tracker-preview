import { loadEnv } from '../server/lib/loadEnv.js';

loadEnv();

const API_BASE_URL = String(process.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const MANAGER_EMAIL = String(process.env.SMOKE_TEAM_MANAGER_EMAIL || 'demo.manager@example.com').trim();
const EMPLOYEE_EMAIL = String(process.env.SMOKE_TEAM_EMPLOYEE_EMAIL || 'ivan.employee@example.com').trim();
const SMOKE_PASSWORD = String(process.env.SMOKE_TEAM_PASSWORD || 'DemoPass123!').trim();

function fail(message) {
  process.stdout.write(`TEAM_SUMMARY_SMOKE: FAIL\n${message}\n`);
  process.exit(1);
}

async function readJsonSafe(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { parseError: true, rawText: text };
  }
}

async function apiRequest(path, { method = 'GET', token = '', body } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await readJsonSafe(response);

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function login(email, password) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (!result.ok || result.payload?.success === false || !result.payload?.token) {
    fail(`Login failed for ${email}. status=${result.status}`);
  }

  return {
    token: String(result.payload.token),
    userId: String(result.payload?.session?.user?.id || ''),
  };
}

function ensure(condition, message) {
  if (!condition) {
    fail(message);
  }
}

async function main() {
  if (!API_BASE_URL) {
    fail('VITE_API_URL is not configured in environment/.env.local');
  }

  const managerSession = await login(MANAGER_EMAIL, SMOKE_PASSWORD);
  const employeeSession = await login(EMPLOYEE_EMAIL, SMOKE_PASSWORD);

  const managerUsers = await apiRequest('/team/users', { token: managerSession.token });
  ensure(managerUsers.ok, `Manager /team/users failed. status=${managerUsers.status}`);
  ensure(Array.isArray(managerUsers.payload?.users), 'Manager /team/users payload.users is not an array');
  ensure(managerUsers.payload.users.length > 0, 'Manager /team/users returned empty users list');

  const employeeUsers = await apiRequest('/team/users', { token: employeeSession.token });
  ensure(employeeUsers.status === 403, `Employee /team/users must be 403, got ${employeeUsers.status}`);

  const allSummary = await apiRequest('/team/summary', { token: managerSession.token });
  ensure(allSummary.ok, `Manager /team/summary failed. status=${allSummary.status}`);
  ensure(Array.isArray(allSummary.payload?.employees), 'Summary employees is not an array');
  ensure(Array.isArray(allSummary.payload?.projects), 'Summary projects is not an array');
  ensure(Array.isArray(allSummary.payload?.reports), 'Summary reports is not an array');

  const firstEmployee = allSummary.payload.employees[0];
  ensure(firstEmployee?.employeeUserId, 'Summary has no employeeUserId for drilldown test');

  const filteredSummary = await apiRequest(
    `/team/summary?employeeUserId=${encodeURIComponent(String(firstEmployee.employeeUserId))}`,
    { token: managerSession.token },
  );

  ensure(filteredSummary.ok, `Filtered /team/summary failed. status=${filteredSummary.status}`);
  ensure(Number(filteredSummary.payload?.scope?.employeesCount || 0) === 1, 'Filtered summary scope.employeesCount must be 1');
  ensure(
    filteredSummary.payload.employees.every((row) => String(row.employeeUserId) === String(firstEmployee.employeeUserId)),
    'Filtered summary returned rows for unexpected employee',
  );

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todaySummary = await apiRequest(
    `/team/summary?startDate=${todayIso}&endDate=${todayIso}`,
    { token: managerSession.token },
  );

  ensure(todaySummary.ok, `Today period /team/summary failed. status=${todaySummary.status}`);
  ensure(todaySummary.payload?.scope?.startDate === todayIso, 'Today summary scope.startDate mismatch');
  ensure(todaySummary.payload?.scope?.endDate === todayIso, 'Today summary scope.endDate mismatch');

  const invalidRangeSummary = await apiRequest(
    '/team/summary?startDate=2099-01-02&endDate=2099-01-01',
    { token: managerSession.token },
  );
  ensure(invalidRangeSummary.status === 400, `Invalid range /team/summary must return 400, got ${invalidRangeSummary.status}`);

  process.stdout.write('TEAM_SUMMARY_SMOKE: PASS\n');
  process.stdout.write(`MANAGER_USERS=${managerUsers.payload.users.length}\n`);
  process.stdout.write(`SUMMARY_EMPLOYEES=${allSummary.payload.employees.length}\n`);
  process.stdout.write(`SUMMARY_REPORTS=${allSummary.payload.reports.length}\n`);
}

main().catch((error) => {
  fail(error?.message || String(error));
});

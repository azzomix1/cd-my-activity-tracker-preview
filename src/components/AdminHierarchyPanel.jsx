import { useEffect, useMemo, useState } from 'react';
import {
  assignHierarchyLinksBulk,
  deleteHierarchyLink,
  fetchAdminUsers,
  fetchHierarchyLinks,
} from '../services/adminApi';

const ROLE_LABELS = {
  administrator: 'Администратор',
  employee: 'Сотрудник',
  line_manager: 'Линейный руководитель',
  full_manager: 'Руководитель (полный)',
};

function buildDisplayName(user) {
  return user.displayName || user.email || user.id;
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesUserSearch(user, query) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  return [
    user.displayName,
    user.email,
    ROLE_LABELS[user.role],
  ]
    .filter(Boolean)
    .some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

export default function AdminHierarchyPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);
  const [managerUserId, setManagerUserId] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showOnlyManagersWithReports, setShowOnlyManagersWithReports] = useState(false);
  const [selectedEmployeeUserIds, setSelectedEmployeeUserIds] = useState([]);
  const [confirmDeleteLink, setConfirmDeleteLink] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError('');

      try {
        const [nextUsers, nextLinks] = await Promise.all([
          fetchAdminUsers(),
          fetchHierarchyLinks(),
        ]);

        if (!isMounted) {
          return;
        }

        setUsers(nextUsers);
        setLinks(nextLinks);
      } catch (nextError) {
        if (!isMounted) {
          return;
        }

        setError(nextError.message || 'Не удалось загрузить данные админки.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const managers = useMemo(
    () => users.filter((user) => user.role === 'line_manager'),
    [users],
  );

  const employees = useMemo(
    () => users.filter((user) => user.role === 'employee'),
    [users],
  );

  const linksByManager = useMemo(() => {
    return links.reduce((result, link) => {
      const key = link.managerUserId;

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(link);
      return result;
    }, {});
  }, [links]);

  const filteredManagers = useMemo(() => {
    return managers.filter((manager) => {
      if (!matchesUserSearch(manager, managerSearch)) {
        return false;
      }

      if (!showOnlyManagersWithReports) {
        return true;
      }

      return (linksByManager[manager.id] || []).length > 0;
    });
  }, [linksByManager, managerSearch, managers, showOnlyManagersWithReports]);

  const filteredEmployees = useMemo(
    () => employees.filter((employee) => matchesUserSearch(employee, employeeSearch)),
    [employeeSearch, employees],
  );

  const assignedEmployeeUserIdsForSelectedManager = useMemo(() => {
    if (!managerUserId) {
      return new Set();
    }

    return new Set((linksByManager[managerUserId] || []).map((link) => link.employeeUserId));
  }, [linksByManager, managerUserId]);

  const filteredAssignedEmployeesCount = useMemo(
    () => filteredEmployees.filter((employee) => assignedEmployeeUserIdsForSelectedManager.has(employee.id)).length,
    [assignedEmployeeUserIdsForSelectedManager, filteredEmployees],
  );

  const filteredAvailableEmployeesCount = Math.max(0, filteredEmployees.length - filteredAssignedEmployeesCount);

  const canSubmit = managerUserId && selectedEmployeeUserIds.length > 0 && !isSaving;

  useEffect(() => {
    setSelectedEmployeeUserIds((prev) => prev.filter((item) => employees.some((employee) => employee.id === item)));
  }, [employees]);

  useEffect(() => {
    setSelectedEmployeeUserIds([]);
  }, [managerUserId]);

  const handleToggleEmployeeSelection = (employeeUserId) => {
    if (assignedEmployeeUserIdsForSelectedManager.has(employeeUserId)) {
      return;
    }

    setSelectedEmployeeUserIds((prev) => {
      if (prev.includes(employeeUserId)) {
        return prev.filter((item) => item !== employeeUserId);
      }

      return [...prev, employeeUserId];
    });
  };

  const handleSelectAllFilteredEmployees = () => {
    setSelectedEmployeeUserIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((employee) => {
        if (assignedEmployeeUserIdsForSelectedManager.has(employee.id)) {
          return;
        }

        next.add(employee.id);
      });

      return Array.from(next);
    });
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployeeUserIds([]);
  };

  const handleAssign = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await assignHierarchyLinksBulk(managerUserId, selectedEmployeeUserIds);
      const nextLinks = await fetchHierarchyLinks();
      setLinks(nextLinks);
      setSelectedEmployeeUserIds([]);
    } catch (nextError) {
      setError(nextError.message || 'Не удалось назначить выбранных сотрудников.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (link) => {
    setConfirmDeleteLink(link);
  };

  const handleDeleteConfirmed = async () => {
    const link = confirmDeleteLink;
    if (!link) return;
    setConfirmDeleteLink(null);
    setIsSaving(true);
    setError('');

    try {
      await deleteHierarchyLink(link.managerUserId, link.employeeUserId);
      const nextLinks = await fetchHierarchyLinks();
      setLinks(nextLinks);
    } catch (nextError) {
      setError(nextError.message || 'Не удалось удалить связь.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <div>
          <h3 className="admin-panel__title">Админка: иерархия сотрудников</h3>
          <p className="admin-panel__subtitle">
            Управление связями линейных руководителей и сотрудников для ограничений создания мероприятий.
          </p>
        </div>
      </div>

      <form className="admin-panel__form" onSubmit={handleAssign}>
        <label>
          Линейный руководитель
          <input
            type="search"
            value={managerSearch}
            onChange={(event) => setManagerSearch(event.target.value)}
            placeholder="Поиск по руководителю"
            disabled={isLoading || isSaving}
          />
          <select
            value={managerUserId}
            onChange={(event) => setManagerUserId(event.target.value)}
            disabled={isLoading || isSaving}
            required
          >
            <option value="">Выберите руководителя</option>
            {filteredManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {buildDisplayName(manager)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Сотрудник
          <input
            type="search"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Поиск по сотруднику"
            disabled={isLoading || isSaving}
          />
          <div className="admin-panel__multi-actions">
            <button type="button" onClick={handleSelectAllFilteredEmployees} disabled={isLoading || isSaving || filteredEmployees.length === 0}>
              Выбрать всех
            </button>
            <button type="button" onClick={handleClearEmployeeSelection} disabled={isLoading || isSaving || selectedEmployeeUserIds.length === 0}>
              Очистить
            </button>
          </div>
          <div className="admin-panel__multi-summary">
            Доступно: {filteredAvailableEmployeesCount} · Уже назначено: {filteredAssignedEmployeesCount}
          </div>
          <div className="admin-panel__multi-list" role="group" aria-label="Выбор сотрудников">
            {filteredEmployees.length === 0 ? (
              <div className="admin-panel__empty">Сотрудники не найдены.</div>
            ) : (
              filteredEmployees.map((employee) => {
                const isAlreadyAssigned = assignedEmployeeUserIdsForSelectedManager.has(employee.id);

                return (
                  <label
                    key={employee.id}
                    className={`admin-panel__multi-item${isAlreadyAssigned ? ' admin-panel__multi-item--assigned' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployeeUserIds.includes(employee.id)}
                      onChange={() => handleToggleEmployeeSelection(employee.id)}
                      disabled={isLoading || isSaving || isAlreadyAssigned}
                    />
                    <span>{buildDisplayName(employee)}</span>
                    {isAlreadyAssigned && <small>уже назначен</small>}
                  </label>
                );
              })
            )}
          </div>
        </label>

        <button type="submit" className="admin-panel__submit" disabled={!canSubmit || isLoading}>
          {isSaving ? 'Сохраняем...' : `Назначить выбранных (${selectedEmployeeUserIds.length})`}
        </button>
      </form>

      <div className="admin-panel__toolbar">
        <label className="admin-panel__toggle">
          <input
            type="checkbox"
            checked={showOnlyManagersWithReports}
            onChange={(event) => setShowOnlyManagersWithReports(event.target.checked)}
          />
          Только руководители с подчиненными
        </label>
        <div className="admin-panel__stats">
          Руководителей: {filteredManagers.length} · Сотрудников: {filteredEmployees.length} · Связей: {links.length}
        </div>
      </div>

      {error && <div className="admin-panel__error">{error}</div>}

      <div className="admin-panel__body">
        {isLoading ? (
          <div className="admin-panel__empty">Загрузка данных...</div>
        ) : links.length === 0 ? (
          <div className="admin-panel__empty">Пока нет назначенных связей.</div>
        ) : (
          <div className="admin-panel__list">
            {filteredManagers.map((manager) => {
              const managerLinks = linksByManager[manager.id] || [];

              return (
                <article key={manager.id} className="admin-panel__manager-card">
                  <div className="admin-panel__manager-header">
                    <div className="admin-panel__manager-name">{buildDisplayName(manager)}</div>
                    <div className="admin-panel__manager-role">{ROLE_LABELS[manager.role] || manager.role}</div>
                  </div>

                  {managerLinks.length === 0 ? (
                    <div className="admin-panel__empty">Нет назначенных сотрудников.</div>
                  ) : (
                    <ul className="admin-panel__employees">
                      {managerLinks.map((link) => (
                        <li key={`${link.managerUserId}-${link.employeeUserId}`}>
                          <div className="admin-panel__employee-meta">
                            <span>{buildDisplayName(link.employee)}</span>
                            <small>{ROLE_LABELS[link.employee.role] || link.employee.role}</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(link)}
                            disabled={isSaving}
                          >
                            Удалить
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteLink && (
        <div className="delete-confirm-overlay" role="dialog" aria-modal="true" aria-label="Подтверждение удаления">
          <div className="delete-confirm-dialog">
            <p className="delete-confirm-dialog__text">
              Удалить связь{' '}
              <strong>{buildDisplayName(confirmDeleteLink.manager)}</strong>
              {' → '}
              <strong>{buildDisplayName(confirmDeleteLink.employee)}</strong>?
            </p>
            <div className="delete-confirm-dialog__actions">
              <button type="button" className="delete-confirm-dialog__btn delete-confirm-dialog__btn--cancel" onClick={() => setConfirmDeleteLink(null)}>Отмена</button>
              <button type="button" className="delete-confirm-dialog__btn delete-confirm-dialog__btn--confirm" onClick={handleDeleteConfirmed}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { Suspense, lazy, useState, useMemo, useEffect, useRef } from 'react';
import { ArrowUp, CircleAlert, CloudCheck, LoaderCircle, Search } from 'lucide-react';
import Calendar from './components/Calendar';
import ActivitiesPanel from './components/ActivitiesPanel';
import { useActivities } from './hooks/useActivities';
import { useActivityReports } from './hooks/useActivityReports';
import { CALENDAR_VIEW_MODES, usePublicCalendar } from './hooks/usePublicCalendar';
import { SESSION_STATUSES, useAuthSession } from './auth/sessionContext.jsx';
import './App.css';

const ActivityModal = lazy(() => import('./components/ActivityModal'));
const PersonalCabinet = lazy(() => import('./components/PersonalCabinet'));
const ReportModal = lazy(() => import('./components/ReportModal'));

const THEMES = {
  DARK: 'aurora',
  LIGHT: 'midnight',
};

const LEGACY_THEME_ALIASES = {
  light: THEMES.LIGHT,
  dark: THEMES.DARK,
};

const REPORTS_STORAGE_KEY = 'activity-tracker-reports';
const REPORT_DRAFTS_STORAGE_KEY = 'activity-tracker-report-drafts';
const PUBLIC_CALENDAR_SETTINGS_STORAGE_KEY = 'activity-tracker-public-calendar-settings';

const ROLE_LABELS = {
  administrator: 'Администратор',
  employee: 'Сотрудник',
  line_manager: 'Линейный руководитель',
  full_manager: 'Руководитель (полный)',
};

function readStoredPublicCalendarSettings() {
  try {
    const rawValue = window.localStorage.getItem(PUBLIC_CALENDAR_SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      calendarViewMode: Object.values(CALENDAR_VIEW_MODES).includes(parsed.calendarViewMode)
        ? parsed.calendarViewMode
        : CALENDAR_VIEW_MODES.MONTH,
      calendarSearchQuery: typeof parsed.calendarSearchQuery === 'string' ? parsed.calendarSearchQuery : '',
      calendarPersonFilter: typeof parsed.calendarPersonFilter === 'string' ? parsed.calendarPersonFilter : 'all',
      calendarTypeFilter: typeof parsed.calendarTypeFilter === 'string' ? parsed.calendarTypeFilter : 'all',
      calendarObjectFilter: typeof parsed.calendarObjectFilter === 'string' ? parsed.calendarObjectFilter : 'all',
    };
  } catch {
    return null;
  }
}

function readStoredReports() {
  try {
    const rawValue = window.localStorage.getItem(REPORTS_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readStoredReportDrafts() {
  try {
    const rawValue = window.localStorage.getItem(REPORT_DRAFTS_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Корневой компонент интерфейса трекера активностей.
 * Отвечает за состояние выбранной даты, открытие модального окна
 * и связывает календарь с панелью активностей.
 *
 * @returns {JSX.Element} Основной layout приложения.
 */
function App() {
  // Текущая дата для инициализации
  const today = new Date();
  const storedPublicCalendarSettings = readStoredPublicCalendarSettings();
  
  // Вид: 'calendar' | 'cabinet'
  const [view, setView] = useState('calendar');
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('activity-tracker-theme');

    if (savedTheme === THEMES.DARK || savedTheme === THEMES.LIGHT) {
      return savedTheme;
    }

    return LEGACY_THEME_ALIASES[savedTheme] || THEMES.DARK;
  });

  // Состояние календаря
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarViewMode, setCalendarViewMode] = useState(
    storedPublicCalendarSettings?.calendarViewMode || CALENDAR_VIEW_MODES.MONTH,
  );
  const [calendarSearchQuery, setCalendarSearchQuery] = useState(
    storedPublicCalendarSettings?.calendarSearchQuery || '',
  );
  const [calendarPersonFilter, setCalendarPersonFilter] = useState(
    storedPublicCalendarSettings?.calendarPersonFilter || 'all',
  );
  const [calendarTypeFilter, setCalendarTypeFilter] = useState(
    storedPublicCalendarSettings?.calendarTypeFilter || 'all',
  );
  const [calendarObjectFilter, setCalendarObjectFilter] = useState(
    storedPublicCalendarSettings?.calendarObjectFilter || 'all',
  );
  
  // Состояние модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [modalInstanceKey, setModalInstanceKey] = useState(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportActivity, setReportActivity] = useState(null);
  const [reportModalInstanceKey, setReportModalInstanceKey] = useState(0);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const statusRef = useRef(null);
  const hasMigratedLegacyReportsRef = useRef(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modalSubmitError, setModalSubmitError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const {
    session,
    sessionStatus,
    isAuthenticated,
    login,
    logout,
  } = useAuthSession();

  // Эффект параллакса для фона
  useEffect(() => {
    // Отключаем параллакс на мобильных устройствах
    const isMobile = window.innerWidth <= 768;
    
    const handleMouseMove = (e) => {
      if (isMobile) return; // Не применяем на мобильных
      
      const x = (e.clientX / window.innerWidth) * 30 - 15; // Диапазон -15 до 15
      const y = (e.clientY / window.innerHeight) * 30 - 15; // Диапазон -15 до 15
      
      document.documentElement.style.setProperty('--bg-x', `${x}px`);
      document.documentElement.style.setProperty('--bg-y', `${y}px`);
    };

    const handleResize = () => {
      // Сбрасываем параллакс при изменении размера окна
      if (window.innerWidth <= 768) {
        document.documentElement.style.setProperty('--bg-x', '0px');
        document.documentElement.style.setProperty('--bg-y', '0px');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setIsStatusExpanded(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsStatusExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    window.localStorage.setItem('activity-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(
      PUBLIC_CALENDAR_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        calendarViewMode,
        calendarSearchQuery,
        calendarPersonFilter,
        calendarTypeFilter,
        calendarObjectFilter,
      }),
    );
  }, [calendarObjectFilter, calendarPersonFilter, calendarSearchQuery, calendarTypeFilter, calendarViewMode]);

  // Хук для работы с активностями
  const {
    activities,
    isLoading,
    isSaving,
    syncError,
    addActivity,
    updateActivity,
    deleteActivity,
    getUniqueValues
  } = useActivities({ isAuthenticated });

  const {
    reportsByActivityId,
    reportDraftsByActivityId,
    isLoading: isReportsLoading,
    isSaving: isReportSaving,
    syncError: reportsSyncError,
    saveReport,
    upsertDraft,
    queueDraftChange,
    discardDraft,
  } = useActivityReports({ enabled: isAuthenticated });

  const activitiesWithReports = useMemo(
    () => activities.map((activity) => {
      const reportData = reportsByActivityId[activity.id] || null;
      const reportDraft = reportDraftsByActivityId[activity.id] || null;

      return {
        ...activity,
        reportData,
        reportDraft,
        reportHasDraft: Boolean(reportDraft),
        reportFilled: Boolean(reportData),
      };
    }),
    [activities, reportDraftsByActivityId, reportsByActivityId],
  );

  useEffect(() => {
    if (hasMigratedLegacyReportsRef.current || isReportsLoading || activities.length === 0) {
      return;
    }

    hasMigratedLegacyReportsRef.current = true;

    const legacyReports = readStoredReports();
    const legacyDrafts = readStoredReportDrafts();
    const validActivityIds = new Set(activities.map((activity) => activity.id));

    const reportEntries = Object.entries(legacyReports).filter(([activityId]) => validActivityIds.has(activityId));
    const draftEntries = Object.entries(legacyDrafts).filter(([activityId]) => validActivityIds.has(activityId));

    if (reportEntries.length === 0 && draftEntries.length === 0) {
      window.localStorage.removeItem(REPORTS_STORAGE_KEY);
      window.localStorage.removeItem(REPORT_DRAFTS_STORAGE_KEY);
      return;
    }

    async function migrateLegacyReportState() {
      try {
        for (const [activityId, reportData] of reportEntries) {
          if (!reportsByActivityId[activityId]) {
            await saveReport(activityId, reportData);
          }
        }

        for (const [activityId, draftData] of draftEntries) {
          if (!reportDraftsByActivityId[activityId] && !reportsByActivityId[activityId]) {
            await upsertDraft(activityId, draftData);
          }
        }

        window.localStorage.removeItem(REPORTS_STORAGE_KEY);
        window.localStorage.removeItem(REPORT_DRAFTS_STORAGE_KEY);
      } catch (error) {
        console.error('Ошибка миграции legacy отчетов из localStorage:', error);
      }
    }

    migrateLegacyReportState();
  }, [activities, isReportsLoading, reportDraftsByActivityId, reportsByActivityId, saveReport, upsertDraft]);

  // Подсказки для автодополнения
  const suggestions = useMemo(() => ({
    names: getUniqueValues('name'),
    persons: getUniqueValues('person'),
    objects: getUniqueValues('objects')
  }), [getUniqueValues]);

  const {
    publicPersons,
    publicObjects,
    filteredPublicActivities,
    selectedDate,
    calendarReferenceDate,
    panelDate,
    activitiesMap,
    selectedDayActivities,
    weekActivities,
    listActivities,
    activeCalendarFiltersCount,
    publicCalendarHasCustomSettings,
    selectedDaySummary,
    calendarPeriodLabel,
  } = usePublicCalendar({
    activities,
    currentYear,
    currentMonth,
    selectedDay,
    calendarViewMode,
    calendarSearchQuery,
    calendarPersonFilter,
    calendarTypeFilter,
    calendarObjectFilter,
  });

  // Обработчики навигации
  /**
   * Сдвигает календарь на указанный месяц вперед/назад.
   * @param {number} delta Смещение месяца (`-1` или `1`).
   * @returns {void}
   */
  const handleMonthChange = (delta) => {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(null);
  };

  /**
   * Переключает календарь на текущую дату.
   * @returns {void}
   */
  const handleTodayClick = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDay(now.getDate());
  };

  /**
   * Выбирает дату в календаре.
   * @param {Date} date Дата выбора.
   * @returns {void}
   */
  const handleDateSelect = (date) => {
    setCurrentYear(date.getFullYear());
    setCurrentMonth(date.getMonth());
    setSelectedDay(date.getDate());
  };

  const handleCalendarPeriodChange = (delta) => {
    if (calendarViewMode === CALENDAR_VIEW_MODES.WEEK) {
      const nextDate = new Date(calendarReferenceDate);
      nextDate.setDate(calendarReferenceDate.getDate() + delta * 7);
      handleDateSelect(nextDate);
      return;
    }

    handleMonthChange(delta);
  };

  const handleCalendarFiltersReset = () => {
    setCalendarSearchQuery('');
    setCalendarPersonFilter('all');
    setCalendarTypeFilter('all');
    setCalendarObjectFilter('all');
    setCalendarViewMode(CALENDAR_VIEW_MODES.MONTH);
  };

  // Обработчики модального окна
  /**
   * Открывает модальное окно в режиме добавления.
   * @returns {void}
   */
  const handleAddClick = () => {
    setEditingActivity(null);
    setModalInstanceKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  /**
   * Открывает модальное окно в режиме редактирования.
   * @param {import('./services/activitiesApi').Activity} activity Редактируемая активность.
   * @returns {void}
   */
  const handleEditClick = (activity) => {
    setEditingActivity(activity);
    setModalInstanceKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  /**
   * Закрывает модальное окно и очищает состояние редактирования.
   * @returns {void}
   */
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingActivity(null);
    setModalSubmitError('');
  };

  const handleReportModalOpen = (activity) => {
    setReportActivity(activity);
    setReportModalInstanceKey((prev) => prev + 1);
    setIsReportModalOpen(true);
  };

  const handleReportModalClose = () => {
    setIsReportModalOpen(false);
    setReportActivity(null);
  };

  const handleReportDraftChange = (activityId, draftData) => {
    if (!activityId) {
      return;
    }

    queueDraftChange(activityId, draftData);
  };

  const handleReportDraftDiscard = async (activityId) => {
    if (!activityId) {
      return;
    }

    await discardDraft(activityId);
  };

  /**
   * Сохраняет активность через хук (create/update в зависимости от режима).
   * @param {import('./services/activitiesApi').Activity} activityData Данные активности.
   * @param {boolean} isEditMode `true` для обновления, `false` для создания.
   * @returns {Promise<void>}
   */
  const handleSave = async (activityData, isEditMode) => {
    const resolvedActivityData = view === 'cabinet' && session.user?.id
      ? {
          ...activityData,
          employeeUserId: String(session.user.id),
        }
      : activityData;

    const result = isEditMode
      ? await updateActivity(resolvedActivityData)
      : await addActivity(resolvedActivityData);

    if (result.success) {
      handleModalClose();
      setActionError('');
      setModalSubmitError('');
      return;
    }

    const errorText = result.error || 'Не удалось сохранить активность.';
    setModalSubmitError(errorText);
    setActionError(errorText);
  };

  /**
   * Удаляет активность после пользовательского подтверждения.
   * @param {string} id Идентификатор активности.
   * @returns {Promise<void>}
   */
  const handleDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const result = await deleteActivity(id);
    if (!result.success) {
      setActionError(result.error || 'Не удалось удалить активность.');
    }
  };

  const handleReportSave = async (reportData) => {
    if (!reportActivity) {
      return;
    }

    const result = await saveReport(reportActivity.id, reportData);

    if (result.success) {
      handleReportModalClose();
      setActionError('');
      return;
    }

    setActionError(result.error || 'Не удалось сохранить отчет.');
  };

  const combinedSyncError = syncError || reportsSyncError;
  const isSystemLoading = isLoading || isReportsLoading;

  const statusText = combinedSyncError
    ? combinedSyncError
    : 'Данные синхронизируются с PostgreSQL API.';

  const statusToneClass = isSystemLoading
    ? 'sync-status--loading'
    : combinedSyncError
      ? 'sync-status--error'
      : 'sync-status--success';

  const statusTitle = isSystemLoading
    ? 'Подключение к PostgreSQL API'
    : combinedSyncError
      ? 'PostgreSQL API недоступен'
      : 'PostgreSQL API подключен';

  const StatusIcon = isSystemLoading
    ? LoaderCircle
    : combinedSyncError
      ? CircleAlert
      : CloudCheck;

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (
      currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    ));
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword) {
      setAuthError('Введите email и пароль.');
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError('');

    try {
      await login(loginEmail.trim(), loginPassword);
      setLoginPassword('');
      setView('cabinet');
    } catch (error) {
      setAuthError(error.message || 'Не удалось выполнить вход.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthSubmitting(true);
    setAuthError('');

    try {
      await logout();
      setView('calendar');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const currentUserDisplayName = session.user?.displayName || session.user?.email || 'Пользователь';
  const currentUserRoleLabel = ROLE_LABELS[session.role] || 'Сотрудник';
  const canManageHierarchy = session.role === 'administrator' || session.role === 'full_manager';

  return (
    <div className={`container${view === 'cabinet' ? ' container--cabinet' : ''}`}>
      <div className="top-controls">
        {/* Навигация между режимами */}
        <nav className="view-nav" aria-label="Переключение режимов">
          <button
            className={`view-nav__btn${view === 'calendar' ? ' view-nav__btn--active' : ''}`}
            onClick={() => setView('calendar')}
          >
            Календарь
          </button>
          <button
            className={`view-nav__btn${view === 'cabinet' ? ' view-nav__btn--active' : ''}`}
            onClick={() => setView('cabinet')}
          >
            Личный кабинет
          </button>
        </nav>
        <div className="top-controls__actions">
          {sessionStatus !== SESSION_STATUSES.LOADING && (
            <span
              className="auth-chip"
              title={isAuthenticated
                ? `${currentUserDisplayName} · ${currentUserRoleLabel}`
                : 'Гостевой доступ'}
            >
              {isAuthenticated
                ? (
                  <>
                    <span className="auth-chip__name">{currentUserDisplayName}</span>
                    <span className="auth-chip__role">{currentUserRoleLabel}</span>
                  </>
                )
                : 'Гость'}
            </span>
          )}
          {isAuthenticated && (
            <button
              type="button"
              className="auth-logout-btn"
              onClick={handleLogout}
              disabled={isAuthSubmitting}
            >
              Выйти
            </button>
          )}
          <button
            className="theme-switch"
            onClick={handleThemeToggle}
            title="Переключить цветовой пресет"
          >
            {theme === THEMES.DARK ? 'Тёмная тема' : 'Светлая тема'}
          </button>
          <div
            ref={statusRef}
            className={`sync-status ${statusToneClass} ${isStatusExpanded ? ' sync-status--expanded' : ''}`}
          >
            <button
              type="button"
              className="sync-status__button"
              aria-live="polite"
              aria-expanded={isStatusExpanded}
              aria-label={statusTitle}
              title={statusTitle}
              onClick={() => setIsStatusExpanded((prev) => !prev)}
            >
              <span className="sync-status__dot" aria-hidden="true"></span>
              <StatusIcon
                size={14}
                aria-hidden="true"
                className={`sync-status__icon${isSystemLoading ? ' sync-status__icon--spin' : ''}`}
              />
              <span className="sync-status__label">API</span>
            </button>

            <div className="sync-status__popover" role="status">
              <div className="sync-status__headline">{statusTitle}</div>
              <div className="sync-status__text">{isSystemLoading ? 'Загрузка данных...' : statusText}</div>
            </div>
          </div>
        </div>
      </div>

      {view === 'calendar' && (
        <div className="calendar-toolbar">
          <div className="calendar-toolbar__group calendar-toolbar__group--search">
            <div className="calendar-toolbar__group-label">Быстрый поиск</div>
            <div className="calendar-toolbar__search">
              <Search size={16} aria-hidden="true" className="calendar-toolbar__search-icon" />
              <input
                type="search"
                value={calendarSearchQuery}
                onChange={(event) => setCalendarSearchQuery(event.target.value)}
                placeholder="По активности, сотруднику или объекту"
                aria-label="Быстрый поиск по публичному календарю"
              />
            </div>
          </div>

          <div className="calendar-toolbar__group calendar-toolbar__group--filters">
            <div className="calendar-toolbar__group-label">Срез</div>
            <div className="calendar-toolbar__filters">
              <select
                value={calendarPersonFilter}
                onChange={(event) => setCalendarPersonFilter(event.target.value)}
                aria-label="Фильтр по сотруднику"
              >
                <option value="all">Все сотрудники</option>
                {publicPersons.map((person) => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>

              <select
                value={calendarTypeFilter}
                onChange={(event) => setCalendarTypeFilter(event.target.value)}
                aria-label="Фильтр по типу активности"
              >
                <option value="all">Все форматы</option>
                <option value="internal">Внутренние</option>
                <option value="external">Внешние</option>
              </select>

              <select
                value={calendarObjectFilter}
                onChange={(event) => setCalendarObjectFilter(event.target.value)}
                aria-label="Фильтр по объекту"
              >
                <option value="all">Все объекты</option>
                {publicObjects.map((objectValue) => (
                  <option key={objectValue} value={objectValue}>{objectValue}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="calendar-toolbar__meta">
            <div className="calendar-toolbar__group calendar-toolbar__group--view">
              <div className="calendar-toolbar__group-label">Режим просмотра</div>
              <div className="calendar-view-switch" role="tablist" aria-label="Режим просмотра календаря">
                <button
                  type="button"
                  className={`calendar-view-switch__btn${calendarViewMode === CALENDAR_VIEW_MODES.MONTH ? ' calendar-view-switch__btn--active' : ''}`}
                  onClick={() => setCalendarViewMode(CALENDAR_VIEW_MODES.MONTH)}
                >
                  Месяц
                </button>
                <button
                  type="button"
                  className={`calendar-view-switch__btn${calendarViewMode === CALENDAR_VIEW_MODES.WEEK ? ' calendar-view-switch__btn--active' : ''}`}
                  onClick={() => setCalendarViewMode(CALENDAR_VIEW_MODES.WEEK)}
                >
                  Неделя
                </button>
                <button
                  type="button"
                  className={`calendar-view-switch__btn${calendarViewMode === CALENDAR_VIEW_MODES.LIST ? ' calendar-view-switch__btn--active' : ''}`}
                  onClick={() => setCalendarViewMode(CALENDAR_VIEW_MODES.LIST)}
                >
                  Список
                </button>
              </div>
            </div>

            <div className="calendar-toolbar__meta-row">
              <span className="calendar-toolbar__badge">Публичный режим · только просмотр</span>
              {publicCalendarHasCustomSettings && (
                <button
                  type="button"
                  className="calendar-toolbar__reset"
                  onClick={handleCalendarFiltersReset}
                >
                  Сбросить вид
                </button>
              )}
            </div>

            <div className="calendar-toolbar__summary">
              Публичных встреч: <strong>{filteredPublicActivities.length}</strong>
              {activeCalendarFiltersCount > 0 ? ` · фильтров: ${activeCalendarFiltersCount}` : ''}
              {calendarViewMode !== CALENDAR_VIEW_MODES.MONTH ? ` · режим: ${calendarViewMode === CALENDAR_VIEW_MODES.WEEK ? 'неделя' : 'список'}` : ''}
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' ? (
        <>
          <Calendar
            currentYear={currentYear}
            currentMonth={currentMonth}
            selectedDay={selectedDay}
            activeDate={panelDate || calendarReferenceDate}
            activitiesMap={activitiesMap}
            viewMode={calendarViewMode}
            weekActivities={weekActivities}
            listActivities={listActivities}
            periodLabel={calendarPeriodLabel}
            onDateSelect={handleDateSelect}
            onPeriodChange={handleCalendarPeriodChange}
            onTodayClick={handleTodayClick}
          />

          <ActivitiesPanel
            selectedDate={panelDate}
            activities={selectedDayActivities}
            summary={selectedDaySummary}
            viewMode={calendarViewMode}
            hasActiveFilters={activeCalendarFiltersCount > 0}
            readOnly
            onAddClick={handleAddClick}
            onEdit={handleEditClick}
            onDelete={handleDelete}
          />
        </>
      ) : (
        <Suspense
          fallback={(
            <div className="activities-section">
              <div className="loading">Загрузка кабинета...</div>
            </div>
          )}
        >
          {!isAuthenticated ? (
            <section className="auth-card" aria-label="Авторизация для личного кабинета">
              <h2>Вход в личный кабинет</h2>
              <p>Публичный календарь доступен без входа. Для кабинета войдите по email и паролю.</p>

              <form className="auth-form" onSubmit={handleLoginSubmit}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="user@company.com"
                    required
                  />
                </label>

                <label>
                  Пароль
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="Введите пароль"
                    required
                  />
                </label>

                {authError && <div className="auth-error">{authError}</div>}

                <button type="submit" disabled={isAuthSubmitting || sessionStatus === SESSION_STATUSES.LOADING}>
                  {isAuthSubmitting ? 'Выполняем вход...' : 'Войти'}
                </button>
              </form>
            </section>
          ) : (
            <>
              <PersonalCabinet
                activities={activitiesWithReports}
                currentUser={session.user}
                canManageHierarchy={canManageHierarchy}
                onReportClick={handleReportModalOpen}
                onAddClick={handleAddClick}
                onEdit={handleEditClick}
                onDelete={handleDelete}
              />
            </>
          )}
        </Suspense>
      )}

      {view === 'calendar' && (
        <button
          type="button"
          className="cabinet__quick-nav cabinet__quick-nav--up mobile-calendar-quick-nav"
          onClick={handleScrollToTop}
          aria-label="Вернуться наверх"
          title="Вернуться наверх"
        >
          <span className="cabinet__quick-nav-icon" aria-hidden="true">
            <ArrowUp size={14} />
          </span>
          <span className="cabinet__quick-nav-label">Наверх</span>
        </button>
      )}

      <Suspense fallback={null}>
        <ActivityModal
          key={modalInstanceKey}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSave}
          activity={editingActivity}
          selectedDate={selectedDate}
          suggestions={suggestions}
          isSubmitting={isSaving}
          submitError={modalSubmitError}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ReportModal
          key={reportModalInstanceKey}
          isOpen={isReportModalOpen}
          activity={reportActivity}
          draftData={reportActivity ? reportDraftsByActivityId[reportActivity.id] || null : null}
          onClose={handleReportModalClose}
          onDraftChange={handleReportDraftChange}
          onDiscardDraft={handleReportDraftDiscard}
          onSave={handleReportSave}
          isSubmitting={isReportSaving}
        />
      </Suspense>
      {actionError && (
        <div className="action-error-banner" role="alert">
          <span>{actionError}</span>
          <button type="button" className="action-error-banner__close" onClick={() => setActionError('')} aria-label="Закрыть">
            ✕
          </button>
        </div>
      )}

      {deleteConfirmId && (
        <div className="delete-confirm-overlay" role="dialog" aria-modal="true" aria-label="Подтверждение удаления">
          <div className="delete-confirm-dialog">
            <p className="delete-confirm-dialog__text">Вы уверены, что хотите удалить эту активность?</p>
            <div className="delete-confirm-dialog__actions">
              <button type="button" className="delete-confirm-dialog__btn delete-confirm-dialog__btn--cancel" onClick={() => setDeleteConfirmId(null)}>Отмена</button>
              <button type="button" className="delete-confirm-dialog__btn delete-confirm-dialog__btn--confirm" onClick={handleDeleteConfirmed}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
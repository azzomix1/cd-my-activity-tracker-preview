import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowUp, CircleAlert, CloudCheck, FlaskConical, LoaderCircle, Search } from 'lucide-react';
import Calendar from './components/Calendar';
import ActivitiesPanel from './components/ActivitiesPanel';
import ActivityModal from './components/ActivityModal';
import PersonalCabinet from './components/PersonalCabinet';
import ReportModal from './components/ReportModal';
import { isPublicActivity } from './auth/accessPolicy';
import { MONTHS, formatDate, parseDate } from './utils/dateUtils';
import { useActivities } from './hooks/useActivities';
import './App.css';

const THEMES = {
  AURORA: 'aurora',
  MIDNIGHT: 'midnight',
};

const LEGACY_THEME_ALIASES = {
  light: THEMES.MIDNIGHT,
  dark: THEMES.AURORA,
};

const REPORTS_STORAGE_KEY = 'activity-tracker-reports';
const REPORT_DRAFTS_STORAGE_KEY = 'activity-tracker-report-drafts';
const LOCAL_TEST_ACTIVITIES_STORAGE_KEY = 'activity-tracker-local-test-activities';
const LOCAL_REPORT_TEST_ACTIVITY_ID = 'local-report-test-activity';
const PUBLIC_CALENDAR_SETTINGS_STORAGE_KEY = 'activity-tracker-public-calendar-settings';
const CALENDAR_VIEW_MODES = {
  MONTH: 'month',
  WEEK: 'week',
  LIST: 'list',
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

function sortActivitiesByTime(activities) {
  return [...activities].sort((left, right) => {
    const timeComparison = (left.time || '').localeCompare(right.time || '');

    if (timeComparison !== 0) {
      return timeComparison;
    }

    return (left.person || left.name || '').localeCompare(right.person || right.name || '');
  });
}

function isSameDay(left, right) {
  return left && right
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function getActivitiesForExactDate(activities, date) {
  if (!date) {
    return [];
  }

  const dateKey = formatDate(date);

  return sortActivitiesByTime(
    activities.filter((activity) => activity.date === dateKey),
  );
}

function buildMonthActivitiesMap(activities, year, month) {
  const result = {};

  activities.forEach((activity) => {
    const activityDate = parseDate(activity.date);

    if (!activityDate) {
      return;
    }

    if (activityDate.getFullYear() !== year || activityDate.getMonth() !== month) {
      return;
    }

    const day = activityDate.getDate();

    if (!result[day]) {
      result[day] = [];
    }

    result[day].push(activity);
  });

  Object.keys(result).forEach((day) => {
    result[day] = sortActivitiesByTime(result[day]);
  });

  return result;
}

function getWeekDates(referenceDate) {
  if (!referenceDate) {
    return [];
  }

  const startOfWeek = new Date(referenceDate);
  const dayOfWeek = startOfWeek.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    return date;
  });
}

function getWeekPeriodLabel(weekDates) {
  if (!weekDates.length) {
    return '';
  }

  const firstDate = weekDates[0];
  const lastDate = weekDates[weekDates.length - 1];

  if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
    return `${firstDate.getDate()}-${lastDate.getDate()} ${MONTHS[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
  }

  if (firstDate.getFullYear() === lastDate.getFullYear()) {
    return `${firstDate.getDate()} ${MONTHS[firstDate.getMonth()]} - ${lastDate.getDate()} ${MONTHS[lastDate.getMonth()]} ${firstDate.getFullYear()}`;
  }

  return `${firstDate.getDate()} ${MONTHS[firstDate.getMonth()]} ${firstDate.getFullYear()} - ${lastDate.getDate()} ${MONTHS[lastDate.getMonth()]} ${lastDate.getFullYear()}`;
}

function getDefaultReferenceDate(year, month) {
  const now = new Date();

  if (now.getFullYear() === year && now.getMonth() === month) {
    return now;
  }

  return new Date(year, month, 1);
}

function getUniqueNonEmptyValues(activities, field) {
  const values = activities
    .map((activity) => activity[field])
    .filter((value) => value && value.trim());

  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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

function readStoredLocalTestActivities() {
  try {
    const rawValue = window.localStorage.getItem(LOCAL_TEST_ACTIVITIES_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

    if (savedTheme === THEMES.AURORA || savedTheme === THEMES.MIDNIGHT) {
      return savedTheme;
    }

    return LEGACY_THEME_ALIASES[savedTheme] || THEMES.AURORA;
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
  const [isReportSaving, setIsReportSaving] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [reportsByActivityId, setReportsByActivityId] = useState(() => readStoredReports());
  const [reportDraftsByActivityId, setReportDraftsByActivityId] = useState(() => readStoredReportDrafts());
  const [localTestActivities, setLocalTestActivities] = useState(() => readStoredLocalTestActivities());
  const statusRef = useRef(null);

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
    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reportsByActivityId));
  }, [reportsByActivityId]);

  useEffect(() => {
    window.localStorage.setItem(REPORT_DRAFTS_STORAGE_KEY, JSON.stringify(reportDraftsByActivityId));
  }, [reportDraftsByActivityId]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_TEST_ACTIVITIES_STORAGE_KEY, JSON.stringify(localTestActivities));
  }, [localTestActivities]);

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
  } = useActivities();

  const combinedActivities = useMemo(() => {
    const activitiesMap = new Map();

    activities.forEach((activity) => {
      activitiesMap.set(activity.id, activity);
    });

    localTestActivities.forEach((activity) => {
      activitiesMap.set(activity.id, activity);
    });

    return Array.from(activitiesMap.values());
  }, [activities, localTestActivities]);

  const activitiesWithReports = useMemo(
    () => combinedActivities.map((activity) => {
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
    [combinedActivities, reportDraftsByActivityId, reportsByActivityId],
  );

  const cabinetPersons = useMemo(() => {
    const values = activitiesWithReports
      .map((activity) => activity.person)
      .filter((value) => value && value.trim());

    return [...new Set(values)].sort();
  }, [activitiesWithReports]);

  // Подсказки для автодополнения
  const suggestions = useMemo(() => ({
    names: getUniqueValues('name'),
    persons: getUniqueValues('person'),
    objects: getUniqueValues('objects')
  }), [getUniqueValues]);

  const publicActivities = useMemo(
    () => activities.filter(isPublicActivity),
    [activities],
  );

  const publicPersons = useMemo(
    () => getUniqueNonEmptyValues(publicActivities, 'person'),
    [publicActivities],
  );

  const publicObjects = useMemo(
    () => getUniqueNonEmptyValues(publicActivities, 'objects'),
    [publicActivities],
  );

  const normalizedSearchQuery = calendarSearchQuery.trim().toLowerCase();

  const filteredPublicActivities = useMemo(
    () => publicActivities.filter((activity) => {
      const matchesQuery = !normalizedSearchQuery || [
        activity.name,
        activity.person,
        activity.objects,
        activity.time,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearchQuery));

      const matchesPerson = calendarPersonFilter === 'all' || activity.person === calendarPersonFilter;
      const matchesType = calendarTypeFilter === 'all' || (activity.eventType || 'internal') === calendarTypeFilter;
      const matchesObject = calendarObjectFilter === 'all' || activity.objects === calendarObjectFilter;

      return matchesQuery && matchesPerson && matchesType && matchesObject;
    }),
    [publicActivities, normalizedSearchQuery, calendarPersonFilter, calendarTypeFilter, calendarObjectFilter],
  );

  const selectedDate = useMemo(
    () => (selectedDay ? new Date(currentYear, currentMonth, selectedDay) : null),
    [currentYear, currentMonth, selectedDay],
  );

  const calendarReferenceDate = useMemo(
    () => selectedDate || getDefaultReferenceDate(currentYear, currentMonth),
    [selectedDate, currentYear, currentMonth],
  );

  const panelDate = useMemo(() => {
    if (selectedDate) {
      return selectedDate;
    }

    if (calendarViewMode === CALENDAR_VIEW_MODES.MONTH) {
      return null;
    }

    return calendarReferenceDate;
  }, [selectedDate, calendarViewMode, calendarReferenceDate]);

  const activitiesMap = useMemo(
    () => buildMonthActivitiesMap(filteredPublicActivities, currentYear, currentMonth),
    [filteredPublicActivities, currentYear, currentMonth],
  );

  const selectedDayActivities = useMemo(
    () => getActivitiesForExactDate(filteredPublicActivities, panelDate),
    [filteredPublicActivities, panelDate],
  );

  const weekDates = useMemo(
    () => getWeekDates(calendarReferenceDate),
    [calendarReferenceDate],
  );

  const weekActivities = useMemo(
    () => weekDates.map((date) => ({
      date,
      activities: getActivitiesForExactDate(filteredPublicActivities, date),
    })),
    [weekDates, filteredPublicActivities],
  );

  const listActivities = useMemo(
    () => sortActivitiesByTime(
      filteredPublicActivities.filter((activity) => {
        const activityDate = parseDate(activity.date);

        return activityDate
          && activityDate.getFullYear() === currentYear
          && activityDate.getMonth() === currentMonth;
      }),
    ),
    [filteredPublicActivities, currentYear, currentMonth],
  );

  const activeCalendarFiltersCount = [calendarPersonFilter, calendarTypeFilter, calendarObjectFilter]
    .filter((value) => value !== 'all').length + (normalizedSearchQuery ? 1 : 0);

  const publicCalendarHasCustomSettings = activeCalendarFiltersCount > 0
    || calendarViewMode !== CALENDAR_VIEW_MODES.MONTH;

  const selectedDaySummary = useMemo(() => {
    if (!panelDate) {
      return null;
    }

    const internalCount = selectedDayActivities.filter((activity) => (activity.eventType || 'internal') === 'internal').length;
    const externalCount = selectedDayActivities.length - internalCount;
    const peopleCount = new Set(selectedDayActivities.map((activity) => activity.person).filter(Boolean)).size;
    const objectCount = new Set(selectedDayActivities.map((activity) => activity.objects).filter(Boolean)).size;

    return {
      total: selectedDayActivities.length,
      internalCount,
      externalCount,
      peopleCount,
      objectCount,
      nextActivity: selectedDayActivities[0] || null,
    };
  }, [panelDate, selectedDayActivities]);

  const calendarPeriodLabel = useMemo(() => {
    if (calendarViewMode === CALENDAR_VIEW_MODES.WEEK) {
      return getWeekPeriodLabel(weekDates);
    }

    return `${MONTHS[currentMonth]} ${currentYear}`;
  }, [calendarViewMode, weekDates, currentMonth, currentYear]);

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

    setReportDraftsByActivityId((prev) => {
      if (!draftData) {
        if (!(activityId in prev)) {
          return prev;
        }

        const nextDrafts = { ...prev };
        delete nextDrafts[activityId];
        return nextDrafts;
      }

      return {
        ...prev,
        [activityId]: {
          ...draftData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleReportDraftDiscard = (activityId) => {
    if (!activityId) {
      return;
    }

    setReportDraftsByActivityId((prev) => {
      if (!(activityId in prev)) {
        return prev;
      }

      const nextDrafts = { ...prev };
      delete nextDrafts[activityId];
      return nextDrafts;
    });
  };

  /**
   * Сохраняет активность через хук (create/update в зависимости от режима).
   * @param {import('./services/activitiesApi').Activity} activityData Данные активности.
   * @param {boolean} isEditMode `true` для обновления, `false` для создания.
   * @returns {Promise<void>}
   */
  const handleSave = async (activityData, isEditMode) => {
    const result = isEditMode
      ? await updateActivity(activityData)
      : await addActivity(activityData);

    if (result.success) {
      handleModalClose();
      return;
    }

    window.alert(result.error || 'Не удалось сохранить активность.');
  };

  /**
   * Удаляет активность после пользовательского подтверждения.
   * @param {string} id Идентификатор активности.
   * @returns {Promise<void>}
   */
  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту активность?')) {
      const result = await deleteActivity(id);

      if (!result.success) {
        window.alert(result.error || 'Не удалось удалить активность.');
        return;
      }

      setReportsByActivityId((prev) => {
        if (!(id in prev)) {
          return prev;
        }

        const nextReports = { ...prev };
        delete nextReports[id];
        return nextReports;
      });

      setReportDraftsByActivityId((prev) => {
        if (!(id in prev)) {
          return prev;
        }

        const nextDrafts = { ...prev };
        delete nextDrafts[id];
        return nextDrafts;
      });
    }
  };

  const handleReportSave = async (reportData) => {
    if (!reportActivity) {
      return;
    }

    setIsReportSaving(true);

    try {
      setReportsByActivityId((prev) => ({
        ...prev,
        [reportActivity.id]: {
          ...reportData,
          updatedAt: new Date().toISOString(),
        },
      }));
      handleReportDraftDiscard(reportActivity.id);
      handleReportModalClose();
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleSeedLocalPastReportTest = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 5);

    const personName = cabinetPersons[0] || 'Тестовый сотрудник';
    const testActivity = {
      id: LOCAL_REPORT_TEST_ACTIVITY_ID,
      date: formatDate(yesterday),
      time: '13:00',
      name: 'Тестовое личное мероприятие',
      person: personName,
      objects: 'Тестовый проект / тестовая площадка',
      eventType: 'internal',
      visibility: 'private',
    };

    const testReport = {
      date: testActivity.date,
      time: testActivity.time,
      employeeName: personName,
      meetingContent: 'Проекты Юнити',
      meetingFormat: 'Презентация',
      projects: ['Юнити', 'Юнити Family', 'Юнити River'],
      notificationsCount: '10',
      telegramSubscriptionsCount: '3',
      comment: 'Тестовый локальный отчет. Нужен для проверки отображения прошедшего личного мероприятия и наполнения карточки в интерфейсе. Комментарий сделан длиннее обычного, чтобы проверить перенос строк и работу формы с развернутым текстом.',
      updatedAt: new Date().toISOString(),
    };

    setLocalTestActivities((prev) => {
      const nextActivities = prev.filter((activity) => activity.id !== LOCAL_REPORT_TEST_ACTIVITY_ID);
      return [...nextActivities, testActivity];
    });

    setReportsByActivityId((prev) => ({
      ...prev,
      [LOCAL_REPORT_TEST_ACTIVITY_ID]: testReport,
    }));

    setView('cabinet');
  };

  const statusText = syncError
    ? syncError
    : 'Данные синхронизируются с Google Sheets.';

  const statusToneClass = isLoading
    ? 'sync-status--loading'
    : syncError
      ? 'sync-status--error'
      : 'sync-status--success';

  const statusTitle = isLoading
    ? 'Подключение к Google Sheets'
    : syncError
      ? 'Google Sheets недоступен'
      : 'Google Sheets подключен';

  const StatusIcon = isLoading
    ? LoaderCircle
    : syncError
      ? CircleAlert
      : CloudCheck;

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (
      currentTheme === THEMES.AURORA ? THEMES.MIDNIGHT : THEMES.AURORA
    ));
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          <button
            className="theme-switch"
            onClick={handleThemeToggle}
            title="Переключить цветовой пресет"
          >
            {theme === THEMES.AURORA ? 'Aurora (темная)' : 'Midnight (светлая)'}
          </button>
          {import.meta.env.DEV && (
            <button
              className="theme-switch dev-tool-btn"
              onClick={handleSeedLocalPastReportTest}
              title="Создать локальный тест прошедшего мероприятия с отчетом"
            >
              <FlaskConical size={14} aria-hidden="true" />
              Тест отчета
            </button>
          )}
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
                className={`sync-status__icon${isLoading ? ' sync-status__icon--spin' : ''}`}
              />
              <span className="sync-status__label">Sheets</span>
            </button>

            <div className="sync-status__popover" role="status">
              <div className="sync-status__headline">{statusTitle}</div>
              <div className="sync-status__text">{isLoading ? 'Загрузка активностей...' : statusText}</div>
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
        <PersonalCabinet
          activities={activitiesWithReports}
          persons={cabinetPersons}
          onReportClick={handleReportModalOpen}
        />
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

      <ActivityModal
        key={modalInstanceKey}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        activity={editingActivity}
        selectedDate={selectedDate}
        suggestions={suggestions}
        isSubmitting={isSaving}
      />

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
    </div>
  );
}

export default App;
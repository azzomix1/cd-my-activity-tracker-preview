import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUp, BellRing, ChevronDown, CircleAlert, Clock3, FileText, Pencil, X } from 'lucide-react';
import { getActivityAudienceLabel, isPrivateActivity, isPublicActivity } from '../auth/accessPolicy';
import AdminHierarchyPanel from './AdminHierarchyPanel';
import PastEventsPanel from './PastEventsPanel';
import { MONTHS, WEEKDAYS, getCalendarData, isToday } from '../utils/dateUtils';
import './PersonalCabinet.css';

const FILTERS = [
  { key: 'all',     label: 'Все' },
  { key: 'private', label: 'Только личные' },
  { key: 'public',  label: 'Только публичные' },
  { key: 'split',   label: 'Два столбца' },
];

function getDateSortKey(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function getTodayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function getRelativeDayKey(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateString(year, month, day) {
  return `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
}

function pluralize(count, one, few, many) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return many;
  }

  if (lastDigit === 1) {
    return one;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }

  return many;
}

function getMissingRequiredActivityFields(activity) {
  const missingFields = [];

  if (!activity?.name?.trim()) {
    missingFields.push('название');
  }

  if (!activity?.time?.trim()) {
    missingFields.push('время');
  }

  if (!activity?.person?.trim()) {
    missingFields.push('сотрудник');
  }

  if (!activity?.objects?.trim()) {
    missingFields.push('объект');
  }

  return missingFields;
}

function getRelativeDateLabel(dateString, todayKey, tomorrowKey) {
  const dateKey = getDateSortKey(dateString);

  if (dateKey === todayKey) {
    return 'Сегодня';
  }

  if (dateKey === tomorrowKey) {
    return 'Завтра';
  }

  return dateString;
}

function buildSessionAliases(currentUser) {
  const aliases = new Set();
  const displayName = String(currentUser?.displayName || '').trim().toLowerCase();
  const email = String(currentUser?.email || '').trim().toLowerCase();

  if (displayName) {
    aliases.add(displayName);
  }

  if (email) {
    aliases.add(email);

    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      aliases.add(email.slice(0, atIndex));
    }
  }

  return aliases;
}

/**
 * Возвращает `true`, если отчет по мероприятию заполнен.
 * При отсутствии поля считаем отчет незаполненным.
 *
 * @param {import('../services/activitiesApi').Activity} activity
 * @returns {boolean}
 */
function isReportFilled(activity) {
  return activity.reportFilled === true;
}

function CabinetAttentionItem({ activity, tone, label, meta, details, actionLabel, onAction }) {
  return (
    <div className={`cabinet-attention-item cabinet-attention-item--${tone}`}>
      <div className="cabinet-attention-item__top">
        <span className="cabinet-attention-item__label">{label}</span>
        <span className="cabinet-attention-item__meta">{meta}</span>
      </div>
      <div className="cabinet-attention-item__title">{activity.name || 'Без названия'}</div>
      {details && <div className="cabinet-attention-item__details">{details}</div>}
      {typeof onAction === 'function' && actionLabel && (
        <button
          type="button"
          className="past-panel__report-btn cabinet-attention-item__action"
          onClick={() => onAction(activity)}
        >
          <FileText size={13} aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function CabinetFocusSection({ section, onReportClick, todayKey, tomorrowKey }) {
  return (
    <section className={`cabinet-focus-card cabinet-focus-card--${section.tone}`}>
      <div className="cabinet-focus-card__header">
        <div className="cabinet-focus-card__title-wrap">
          <span className="cabinet-focus-card__icon"><section.icon size={15} aria-hidden="true" /></span>
          <div>
            <div className="cabinet-focus-card__eyebrow">{section.eyebrow}</div>
            <h4 className="cabinet-focus-card__title">{section.title}</h4>
          </div>
        </div>
        <div className="cabinet-focus-card__meta">
          <span className="cabinet-focus-card__priority">{section.priorityLabel}</span>
          <span className="cabinet__filter-count">{section.count}</span>
        </div>
      </div>
      <div className="cabinet-focus-card__list">
        {section.count === 0 ? (
          <div className="no-activities">{section.emptyText}</div>
        ) : (
          section.items.slice(0, section.previewLimit).map((activity) => {
            if (section.key === 'reports') {
              return (
                <CabinetAttentionItem
                  key={activity.id}
                  activity={activity}
                  tone={section.tone}
                  label={activity.reportHasDraft ? 'Черновик открыт' : 'Нужен отчет'}
                  meta={`${activity.date}${activity.time ? ` · ${activity.time}` : ''}`}
                  details={activity.person || activity.objects || 'Откройте отчет и завершите карточку'}
                  actionLabel={activity.reportHasDraft ? 'Продолжить' : 'Заполнить'}
                  onAction={onReportClick}
                />
              );
            }

            if (section.key === 'upcoming') {
              return (
                <CabinetAttentionItem
                  key={activity.id}
                  activity={activity}
                  tone={section.tone}
                  label={getRelativeDateLabel(activity.date, todayKey, tomorrowKey)}
                  meta={activity.time || 'Без времени'}
                  details={activity.person || activity.objects || 'Проверьте карточку перед днем мероприятия'}
                />
              );
            }

            return (
              <CabinetAttentionItem
                key={activity.id}
                activity={activity}
                tone={section.tone}
                label={getRelativeDateLabel(activity.date, todayKey, tomorrowKey)}
                meta={activity.time || 'Без времени'}
                details={`Не хватает: ${activity.missingFields.join(', ')}`}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

/**
 * Карточка мероприятия в личном кабинете.
 *
 * @param {{ activity: import('../services/activitiesApi').Activity, onEdit?: Function, onDelete?: Function, onReportClick?: Function }} props
 */
function CabinetEventCard({ activity, onEdit, onDelete, onReportClick, showReportStatus = false }) {
  const isPrivate  = isPrivateActivity(activity);
  const isExternal = activity.eventType === 'external';
  const canEdit   = typeof onEdit === 'function';
  const canDelete = typeof onDelete === 'function';
  const hasActions = canEdit || canDelete;
  const canOpenReport = typeof onReportClick === 'function';
  const reportFilled = isReportFilled(activity);
  const reportHasDraft = activity.reportHasDraft === true;
  const missingFields = getMissingRequiredActivityFields(activity);
  const hasMissingFields = missingFields.length > 0;
  const reportButtonLabel = reportHasDraft
    ? 'Продолжить черновик'
    : reportFilled
      ? 'Изменить отчет'
      : 'Заполнить отчет';

  return (
    <div
      className={`cabinet-card ${
        isExternal ? 'cabinet-card--external' : 'cabinet-card--internal'
      }`}
    >
      <div className="cabinet-card__top">
        <div className="cabinet-card__time-group">
          <span className="cabinet-card__time">{activity.time || 'Без времени'}</span>
          <span className="cabinet-card__date">{activity.date}</span>
        </div>
        <div className="cabinet-card__top-right">
          <span
            className={`cabinet-badge ${
              isPrivate ? 'cabinet-badge--private' : 'cabinet-badge--public'
            }`}
          >
            {getActivityAudienceLabel(activity)}
          </span>
          {showReportStatus && (
            <span
              className={`cabinet-badge ${
                reportFilled ? 'cabinet-badge--report-filled' : 'cabinet-badge--report-missing'
              }`}
            >
              {reportFilled ? 'отчет заполнен' : 'отчет не заполнен'}
            </span>
          )}
          {reportHasDraft && (
            <span className="cabinet-badge cabinet-badge--draft">есть черновик</span>
          )}
          {hasMissingFields && (
            <span className="cabinet-badge cabinet-badge--missing-fields">нужны поля</span>
          )}
          {hasActions && (
            <div className="cabinet-card__actions">
              {canEdit && (
                <button
                  className="btn btn-edit"
                  onClick={() => onEdit(activity)}
                  title="Редактировать"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              )}
              {canDelete && (
                <button
                  className="btn btn-delete"
                  onClick={() => onDelete(activity.id)}
                  title="Удалить"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="cabinet-card__name">{activity.name}</div>
      {(activity.person || activity.objects) && (
        <div className="cabinet-card__meta">
          {activity.person && <span className="cabinet-card__person">{activity.person}</span>}
          {activity.person && activity.objects && <span className="cabinet-card__meta-separator" aria-hidden="true">•</span>}
          {activity.objects && <span className="cabinet-card__objects">{activity.objects}</span>}
        </div>
      )}
      {hasMissingFields && (
        <div className="cabinet-card__missing-fields">
          Не хватает: {missingFields.join(', ')}
        </div>
      )}
      {canOpenReport && (
        <div className="cabinet-card__report-row">
          <button
            type="button"
            className="past-panel__report-btn cabinet-card__report-btn"
            onClick={() => onReportClick(activity)}
          >
            <FileText size={13} aria-hidden="true" />
            {reportButtonLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Личный кабинет сотрудника.
 *
 * @param {Object} props
 * @param {import('../services/activitiesApi').Activity[]} props.activities Все активности (включая личные).
 * @param {{ id?: string, email?: string, displayName?: string } | null} props.currentUser Авторизованный пользователь текущей сессии.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} props.onReportClick Открытие окна отчета.
 * @param {() => void} [props.onAddClick] Добавление мероприятия.
 * @param {(activity: import('../services/activitiesApi').Activity) => void} [props.onEdit] Редактирование мероприятия.
 * @param {(id: string) => void} [props.onDelete] Удаление мероприятия.
 * @returns {JSX.Element}
 */
function PersonalCabinet({ activities, currentUser, canManageHierarchy, onReportClick, onAddClick, onEdit, onDelete }) {
  const todayKey = getTodayKey();
  const tomorrowKey = getRelativeDayKey(1);
  const today = useMemo(() => new Date(), []);
  const attentionSectionRef = useRef(null);
  const upcomingSectionRef = useRef(null);
  const hierarchyDropdownRef = useRef(null);
  const currentPerson = String(currentUser?.displayName || currentUser?.email || '').trim();
  const sessionAliases = useMemo(() => buildSessionAliases(currentUser), [currentUser]);

  const [filter, setFilter]               = useState('all');
  const [isPastOpen, setIsPastOpen]       = useState(false);
  const [isPastMissingOpen, setIsPastMissingOpen] = useState(true);
  const [isPastFilledOpen, setIsPastFilledOpen] = useState(false);
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [prevCurrentPerson, setPrevCurrentPerson] = useState(currentPerson);

  if (prevCurrentPerson !== currentPerson) {
    setPrevCurrentPerson(currentPerson);
    setSelectedDateFilter('');
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
  }

  useEffect(() => {
    if (!isHierarchyOpen) return undefined;

    function handlePointerDown(event) {
      if (hierarchyDropdownRef.current && !hierarchyDropdownRef.current.contains(event.target)) {
        setIsHierarchyOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setIsHierarchyOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isHierarchyOpen]);

  const pastSectionRef = useRef(null);

  // --- Фильтрация по сотруднику ---
  const myActivities = useMemo(
    () => activities.filter((activity) => {
      const employeeUserId = String(activity.employeeUserId || '').trim();
      const currentUserId = String(currentUser?.id || '').trim();

      if (employeeUserId && currentUserId) {
        return employeeUserId === currentUserId;
      }

      const activityPerson = String(activity.person || '').trim().toLowerCase();
      return activityPerson && sessionAliases.has(activityPerson);
    }),
    [activities, currentUser, sessionAliases],
  );

  // --- Предстоящие (дата >= сегодня) ---
  const upcomingActivities = useMemo(
    () =>
      myActivities
        .filter((a) => getDateSortKey(a.date) >= todayKey)
        .sort((a, b) => {
          const dc = getDateSortKey(a.date).localeCompare(getDateSortKey(b.date));
          return dc !== 0 ? dc : (a.time || '').localeCompare(b.time || '');
        }),
    [myActivities, todayKey],
  );

  // --- Прошедшие (дата < сегодня), для панели слева ---
  const pastActivities = useMemo(
    () =>
      myActivities
        .filter((a) => getDateSortKey(a.date) < todayKey)
        .sort((a, b) => {
          const dc = getDateSortKey(b.date).localeCompare(getDateSortKey(a.date));
          return dc !== 0 ? dc : (b.time || '').localeCompare(a.time || '');
        }),
    [myActivities, todayKey],
  );

  const pastFilledActivities = useMemo(
    () => pastActivities.filter((activity) => isReportFilled(activity)),
    [pastActivities],
  );

  const pastMissingActivities = useMemo(
    () => pastActivities.filter((activity) => !isReportFilled(activity)),
    [pastActivities],
  );

  const todayActivities = useMemo(
    () => upcomingActivities.filter((activity) => getDateSortKey(activity.date) === todayKey),
    [todayKey, upcomingActivities],
  );

  const tomorrowActivities = useMemo(
    () => upcomingActivities.filter((activity) => getDateSortKey(activity.date) === tomorrowKey),
    [tomorrowKey, upcomingActivities],
  );

  const activitiesWithMissingFields = useMemo(
    () => myActivities
      .map((activity) => ({
        ...activity,
        missingFields: getMissingRequiredActivityFields(activity),
      }))
      .filter((activity) => activity.missingFields.length > 0)
      .sort((left, right) => {
        const dateComparison = getDateSortKey(left.date).localeCompare(getDateSortKey(right.date));
        return dateComparison !== 0 ? dateComparison : (left.time || '').localeCompare(right.time || '');
      }),
    [myActivities],
  );

  const reportDraftActivities = useMemo(
    () => myActivities
      .filter((activity) => activity.reportHasDraft)
      .sort((left, right) => {
        const dateComparison = getDateSortKey(left.date).localeCompare(getDateSortKey(right.date));
        return dateComparison !== 0 ? dateComparison : (left.time || '').localeCompare(right.time || '');
      }),
    [myActivities],
  );

  const reminderItems = useMemo(() => {
    const items = [];

    if (todayActivities.length > 0) {
      items.push({
        key: 'today',
        tone: 'primary',
        text: `Сегодня есть ${todayActivities.length} ${pluralize(todayActivities.length, 'мероприятие', 'мероприятия', 'мероприятий')}`,
      });
    }

    if (pastMissingActivities.length > 0) {
      items.push({
        key: 'reports',
        tone: 'warning',
        text: `По ${pastMissingActivities.length} прошедшим ${pluralize(pastMissingActivities.length, 'мероприятию', 'мероприятиям', 'мероприятиям')} не заполнен отчет`,
      });
    }

    if (activitiesWithMissingFields.length > 0) {
      items.push({
        key: 'fields',
        tone: 'danger',
        text: `У ${activitiesWithMissingFields.length} ${pluralize(activitiesWithMissingFields.length, 'мероприятия', 'мероприятий', 'мероприятий')} не хватает обязательных полей`,
      });
    }

    return items;
  }, [activitiesWithMissingFields.length, pastMissingActivities.length, todayActivities.length]);

  // --- Вспомогательные выборки для счётчиков ---
  // --- Активный список в зависимости от фильтра ---
  const dateFilteredUpcoming = useMemo(() => {
    if (!selectedDateFilter) {
      return upcomingActivities;
    }

    return upcomingActivities.filter((activity) => activity.date === selectedDateFilter);
  }, [selectedDateFilter, upcomingActivities]);

  const filteredPrivateUpcoming = useMemo(
    () => dateFilteredUpcoming.filter(isPrivateActivity),
    [dateFilteredUpcoming],
  );

  const filteredPublicUpcoming = useMemo(
    () => dateFilteredUpcoming.filter(isPublicActivity),
    [dateFilteredUpcoming],
  );

  const filteredUpcoming = useMemo(() => {
    if (filter === 'private') return filteredPrivateUpcoming;
    if (filter === 'public') return filteredPublicUpcoming;
    return dateFilteredUpcoming;
  }, [dateFilteredUpcoming, filter, filteredPrivateUpcoming, filteredPublicUpcoming]);

  const employeeCalendarDates = useMemo(
    () => new Set(upcomingActivities.map((activity) => activity.date)),
    [upcomingActivities],
  );

  const miniCalendarDays = useMemo(() => {
    const calendarData = getCalendarData(calendarYear, calendarMonth);
    const days = [];

    for (let index = 0; index < calendarData.startDayOfWeek; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= calendarData.daysInMonth; day += 1) {
      days.push(day);
    }

    return days;
  }, [calendarMonth, calendarYear]);

  function getFilterCount(key) {
    if (key === 'private') return filteredPrivateUpcoming.length;
    if (key === 'public')  return filteredPublicUpcoming.length;
    if (key === 'all')     return dateFilteredUpcoming.length;
    return null; // split — счётчик не нужен
  }

  function handleMiniCalendarMonthChange(delta) {
    let nextMonth = calendarMonth + delta;
    let nextYear = calendarYear;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    } else if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    }

    setCalendarMonth(nextMonth);
    setCalendarYear(nextYear);
  }

  function handleMiniCalendarDateSelect(day) {
    const dateString = toDateString(calendarYear, calendarMonth, day);

    if (!employeeCalendarDates.has(dateString)) {
      return;
    }

    setSelectedDateFilter((currentValue) => (
      currentValue === dateString ? '' : dateString
    ));
  }

  function handleClearDateFilter() {
    setSelectedDateFilter('');
  }

  const handleFocusDate = useCallback((date) => {
    setSelectedDateFilter(date);
    setFilter('all');
  }, [setFilter]);

  function handleQuickNavigation() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSectionNavigation = useCallback((sectionKey) => {
    if (sectionKey === 'attention') {
      attentionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (sectionKey === 'upcoming') {
      upcomingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (sectionKey === 'history') {
      pastSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }, []);

  const totalAttentionCount = pastMissingActivities.length + reportDraftActivities.length + activitiesWithMissingFields.length;
  const activeFilterLabel = FILTERS.find((item) => item.key === filter)?.label || 'Все';
  const nextActivity = upcomingActivities[0] || null;
  const attentionSections = useMemo(() => {
    const sections = [
      {
        key: 'reports',
        title: 'Прошедшие без отчета',
        eyebrow: 'Отчеты',
        tone: 'warning',
        icon: AlertTriangle,
        items: pastMissingActivities,
        count: pastMissingActivities.length,
        emptyText: 'Все прошедшие уже закрыты отчетами',
        previewLimit: 3,
        priorityScore: pastMissingActivities.length * 100 + reportDraftActivities.filter((activity) => getDateSortKey(activity.date) < todayKey).length * 20,
      },
      {
        key: 'upcoming',
        title: 'Сегодня и завтра',
        eyebrow: 'Ближайшее',
        tone: 'primary',
        icon: Clock3,
        items: [...todayActivities, ...tomorrowActivities],
        count: todayActivities.length + tomorrowActivities.length,
        emptyText: 'На ближайшие два дня событий нет',
        previewLimit: 4,
        priorityScore: todayActivities.length * 70 + tomorrowActivities.length * 35,
      },
      {
        key: 'data',
        title: 'Незаполненные поля',
        eyebrow: 'Качество данных',
        tone: 'danger',
        icon: CircleAlert,
        items: activitiesWithMissingFields,
        count: activitiesWithMissingFields.length,
        emptyText: 'По карточкам сотрудника пробелов нет',
        previewLimit: 3,
        priorityScore: activitiesWithMissingFields.length * 80,
      },
    ];

    const sortedSections = [...sections].sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return right.count - left.count;
    });

    return sortedSections.map((section, index) => ({
      ...section,
      priorityLabel: index === 0 ? 'Сейчас главное' : `Приоритет ${index + 1}`,
    }));
  }, [activitiesWithMissingFields, pastMissingActivities, reportDraftActivities, todayActivities, tomorrowActivities, todayKey]);
  const overviewCards = useMemo(() => [
    {
      key: 'upcoming',
      label: 'Впереди',
      value: upcomingActivities.length,
      tone: 'primary',
      description: 'все предстоящие мероприятия',
    },
    {
      key: 'attention',
      label: 'Фокус',
      value: totalAttentionCount,
      tone: 'warning',
      description: 'отчеты, черновики и пробелы',
    },
    {
      key: 'today',
      label: 'На 48 часов',
      value: todayActivities.length + tomorrowActivities.length,
      tone: 'neutral',
      description: 'сегодня и завтра',
    },
    {
      key: 'drafts',
      label: 'Черновики',
      value: reportDraftActivities.length,
      tone: 'danger',
      description: 'незавершенные отчеты',
    },
  ], [reportDraftActivities.length, todayActivities, tomorrowActivities, totalAttentionCount, upcomingActivities.length]);

  const handleCardClick = useCallback((key) => {
    if (key === 'upcoming') {
      upcomingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (key === 'attention') {
      attentionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (key === 'today') {
      handleFocusDate(todayActivities[0]?.date || tomorrowActivities[0]?.date || '');
    } else if (key === 'drafts') {
      setIsPastOpen(true);
    }
  }, [handleFocusDate, todayActivities, tomorrowActivities]);

  return (
    <div className="cabinet">
      {/* Панель прошедших мероприятий */}
      <PastEventsPanel
        isOpen={isPastOpen}
        onToggle={() => setIsPastOpen((p) => !p)}
        draftActivities={reportDraftActivities}
        upcomingActivities={[...todayActivities, ...tomorrowActivities]}
        incompleteActivities={activitiesWithMissingFields}
        onReportClick={onReportClick}
        onFocusDate={handleFocusDate}
      />

      <div className="cabinet__content">
        {/* ── Шапка ── */}
        <div className="cabinet__header">
          <div className="cabinet__user">
            <div className="cabinet__avatar" aria-hidden="true">
              <span>{currentPerson ? currentPerson.charAt(0).toUpperCase() : '?'}</span>
            </div>
            <div className="cabinet__user-meta">
              <span className="cabinet__user-label">Личный кабинет</span>
              <div className="cabinet__person-select" role="status" aria-label="Текущий сотрудник">
                {currentPerson || 'Пользователь не определен'}
              </div>
            </div>
          </div>

          <button
            className="btn btn-add cabinet__add-btn"
            onClick={onAddClick}
            title="Добавить мероприятие"
            disabled={typeof onAddClick !== 'function'}
          >
            + Добавить мероприятие
          </button>
        </div>

        <div className="cabinet__body">
          <section className="cabinet__hero">
            <div className="cabinet__hero-main">
              <div className="cabinet__hero-copy">
                <div className="cabinet__hero-eyebrow">Личный кабинет</div>
                <h2 className="cabinet__hero-title">
                  {currentPerson || 'Кабинет сотрудника'}
                </h2>
              </div>

              <div className="cabinet__summary-grid">
                {overviewCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`cabinet-summary-card cabinet-summary-card--${card.tone}`}
                    onClick={() => handleCardClick(card.key)}
                    disabled={card.key === 'today' && !todayActivities[0] && !tomorrowActivities[0]}
                  >
                    <span className="cabinet-summary-card__label">{card.label}</span>
                    <span className="cabinet-summary-card__value">{card.value}</span>
                    <span className="cabinet-summary-card__description">{card.description}</span>
                  </button>
                ))}
              </div>

              <div className="cabinet__hero-nav" role="navigation" aria-label="Быстрая навигация по кабинету">
                <button type="button" className="cabinet__hero-nav-btn" onClick={() => handleSectionNavigation('attention')}>
                  Фокус
                </button>
                <button type="button" className="cabinet__hero-nav-btn" onClick={() => handleSectionNavigation('upcoming')}>
                  Расписание
                </button>
                <button type="button" className="cabinet__hero-nav-btn" onClick={() => handleSectionNavigation('history')}>
                  История
                </button>

                {canManageHierarchy && (
                  <div className="cabinet__hierarchy-dropdown" ref={hierarchyDropdownRef}>
                    <button
                      type="button"
                      className={`cabinet__hero-nav-btn cabinet__hero-nav-btn--hierarchy${isHierarchyOpen ? ' cabinet__hero-nav-btn--active' : ''}`}
                      onClick={() => setIsHierarchyOpen((prev) => !prev)}
                      aria-expanded={isHierarchyOpen}
                    >
                      Иерархия
                      <ChevronDown
                        size={12}
                        aria-hidden="true"
                        className={`cabinet__hierarchy-chevron${isHierarchyOpen ? ' cabinet__hierarchy-chevron--open' : ''}`}
                      />
                    </button>

                    {isHierarchyOpen && (
                      <div className="cabinet__hierarchy-panel">
                        <AdminHierarchyPanel />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cabinet__reminders">
                {reminderItems.length === 0 ? (
                  <div className="cabinet__reminder cabinet__reminder--neutral">
                    <BellRing size={14} aria-hidden="true" />
                    <span>Срочных напоминаний нет.</span>
                  </div>
                ) : (
                  reminderItems.map((item) => (
                    <div key={item.key} className={`cabinet__reminder cabinet__reminder--${item.tone}`}>
                      <BellRing size={14} aria-hidden="true" />
                      <span>{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <aside className="cabinet__hero-aside">
              <div className="cabinet__context-card">
                <div className="cabinet__context-label">Текущий режим</div>
                <div className="cabinet__context-value">{activeFilterLabel}</div>
                <div className="cabinet__context-hint">
                  {selectedDateFilter ? `Фильтр по дате: ${selectedDateFilter}` : 'Показываются все даты сотрудника'}
                </div>
              </div>

              <div className="cabinet__context-card cabinet__context-card--accent">
                <div className="cabinet__context-label">Следующее мероприятие</div>
                <div className="cabinet__context-value">
                  {nextActivity ? `${nextActivity.date}${nextActivity.time ? ` · ${nextActivity.time}` : ''}` : 'Нет событий впереди'}
                </div>
                <div className="cabinet__context-hint">
                  {nextActivity ? nextActivity.name || 'Без названия' : 'Можно переключиться на другого сотрудника или открыть историю'}
                </div>
              </div>

              <aside className="cabinet-mini cabinet-mini--hero">
                <div className="cabinet-mini__header">
                  <div>
                    <h4 className="cabinet-mini__title">Календарь сотрудника</h4>
                    <div className="cabinet-mini__hint">Фильтр по мероприятиям сотрудника</div>
                  </div>
                  <button
                    className="cabinet-mini__reset"
                    onClick={handleClearDateFilter}
                    disabled={!selectedDateFilter}
                    title="Сбросить фильтр по дате"
                  >
                    Сбросить
                  </button>
                </div>

                <div className="cabinet-mini__month-nav">
                  <button className="cabinet-mini__month-btn" onClick={() => handleMiniCalendarMonthChange(-1)}>
                    ←
                  </button>
                  <div className="cabinet-mini__month-label">{MONTHS[calendarMonth]} {calendarYear}</div>
                  <button className="cabinet-mini__month-btn" onClick={() => handleMiniCalendarMonthChange(1)}>
                    →
                  </button>
                </div>

                <div className="cabinet-mini__weekdays">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="cabinet-mini__weekday">{day}</span>
                  ))}
                </div>

                <div className="cabinet-mini__grid">
                  {miniCalendarDays.map((day, index) => {
                    if (!day) {
                      return <span key={`empty-${index}`} className="cabinet-mini__day cabinet-mini__day--empty" />;
                    }

                    const dateString = toDateString(calendarYear, calendarMonth, day);
                    const hasEmployeeActivity = employeeCalendarDates.has(dateString);
                    const isSelected = selectedDateFilter === dateString;
                    const isCurrentDay = isToday(calendarYear, calendarMonth, day);

                    return (
                      <button
                        key={dateString}
                        className={`cabinet-mini__day${hasEmployeeActivity ? ' cabinet-mini__day--active' : ''}${isSelected ? ' cabinet-mini__day--selected' : ''}${isCurrentDay ? ' cabinet-mini__day--today' : ''}`}
                        onClick={() => handleMiniCalendarDateSelect(day)}
                        title={hasEmployeeActivity ? `Мероприятия на ${dateString}` : 'Нет мероприятий'}
                        type="button"
                      >
                        <span>{day}</span>
                        {hasEmployeeActivity && <span className="cabinet-mini__dot" />}
                      </button>
                    );
                  })}
                </div>
              </aside>
            </aside>
          </section>

          <div className="cabinet__events">
            <section className="cabinet__attention" ref={attentionSectionRef}>
              <div className="cabinet__section-header">
                <div>
                  <h3 className="cabinet__section-title">Требует внимания</h3>
                  <div className="cabinet__section-hint">Карточки автоматически выстроены по срочности</div>
                </div>
              </div>

              <div className="cabinet__attention-grid">
                {attentionSections.map((section) => (
                  <CabinetFocusSection
                    key={section.key}
                    section={section}
                    onReportClick={onReportClick}
                    todayKey={todayKey}
                    tomorrowKey={tomorrowKey}
                  />
                ))}
              </div>
            </section>

            <section className="cabinet-panel cabinet-panel--schedule" ref={upcomingSectionRef}>
              <div className="cabinet-panel__header">
                <div>
                  <h3 className="cabinet__section-title">Предстоящие мероприятия</h3>
                  <div className="cabinet__section-hint">Основная зона со списком, режимами и фильтром по дню</div>
                </div>
                <div className="cabinet-panel__header-meta">
                  {selectedDateFilter && (
                    <div className="cabinet__selected-date">Дата: {selectedDateFilter}</div>
                  )}
                  {!currentPerson && (
                    <span className="cabinet__section-hint">Выберите сотрудника выше</span>
                  )}
                </div>
              </div>

              <div className="cabinet__filters" role="group" aria-label="Фильтр мероприятий">
                {FILTERS.map((f) => {
                  const count = getFilterCount(f.key);
                  return (
                    <button
                      key={f.key}
                      className={`cabinet__filter-btn${
                        filter === f.key ? ' cabinet__filter-btn--active' : ''
                      }`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label}
                      {count !== null && (
                        <span className="cabinet__filter-count">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="cabinet__events-main">
                <div className="cabinet__events-content">
                {filter === 'split' ? (
                  <div className="cabinet__split">
                    <div className="cabinet__split-col">
                      <div className="cabinet__col-header cabinet__col-header--private">
                        <span className="cabinet__col-dot" />
                        Личные
                        <span className="cabinet__filter-count">{filteredPrivateUpcoming.length}</span>
                      </div>
                      <div className="cabinet__col-list">
                        {filteredPrivateUpcoming.length === 0 ? (
                          <div className="no-activities">Нет личных мероприятий</div>
                        ) : (
                          filteredPrivateUpcoming.map((a) => (
                            <CabinetEventCard
                              key={a.id}
                              activity={a}
                              onEdit={onEdit}
                              onDelete={onDelete}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="cabinet__split-col">
                      <div className="cabinet__col-header cabinet__col-header--public">
                        <span className="cabinet__col-dot cabinet__col-dot--public" />
                        Публичные
                        <span className="cabinet__filter-count">{filteredPublicUpcoming.length}</span>
                      </div>
                      <div className="cabinet__col-list">
                        {filteredPublicUpcoming.length === 0 ? (
                          <div className="no-activities">Нет публичных мероприятий</div>
                        ) : (
                          filteredPublicUpcoming.map((a) => (
                            <CabinetEventCard
                              key={a.id}
                              activity={a}
                              onEdit={onEdit}
                              onDelete={onDelete}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="cabinet__list">
                    {filteredUpcoming.length === 0 ? (
                      <div className="no-activities">Нет предстоящих мероприятий</div>
                    ) : (
                      filteredUpcoming.map((a) => (
                        <CabinetEventCard
                          key={a.id}
                          activity={a}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
              </div>
            </section>

            <section className="cabinet__past cabinet-panel cabinet-panel--history" ref={pastSectionRef}>
              <div className="cabinet__section-header">
                <h3 className="cabinet__section-title">Прошедшие мероприятия</h3>
                <span className="cabinet__section-hint">С отображением статуса отчета</span>
              </div>

              <div className="cabinet__past-stack">
                <section className="cabinet__accordion">
                  <button
                    type="button"
                    className="cabinet__col-header cabinet__col-header--private cabinet__accordion-toggle"
                    onClick={() => setIsPastMissingOpen((value) => !value)}
                  >
                    <span className="cabinet__col-dot" />
                    С незаполненным отчетом
                    <span className="cabinet__filter-count">{pastMissingActivities.length}</span>
                    <span className={`cabinet__accordion-arrow${isPastMissingOpen ? ' cabinet__accordion-arrow--open' : ''}`}>
                      <ChevronDown size={14} aria-hidden="true" />
                    </span>
                  </button>

                  {isPastMissingOpen && (
                    <div className="cabinet__accordion-body">
                      <div className="cabinet__col-list cabinet__col-list--past">
                        {pastMissingActivities.length === 0 ? (
                          <div className="no-activities">Нет прошедших без отчета</div>
                        ) : (
                          pastMissingActivities.map((activity) => (
                            <CabinetEventCard
                              key={activity.id}
                              activity={activity}
                              onReportClick={onReportClick}
                              showReportStatus
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="cabinet__accordion">
                  <button
                    type="button"
                    className="cabinet__col-header cabinet__col-header--public cabinet__accordion-toggle"
                    onClick={() => setIsPastFilledOpen((value) => !value)}
                  >
                    <span className="cabinet__col-dot cabinet__col-dot--public" />
                    С заполненным отчетом
                    <span className="cabinet__filter-count">{pastFilledActivities.length}</span>
                    <span className={`cabinet__accordion-arrow${isPastFilledOpen ? ' cabinet__accordion-arrow--open' : ''}`}>
                      <ChevronDown size={14} aria-hidden="true" />
                    </span>
                  </button>

                  {isPastFilledOpen && (
                    <div className="cabinet__accordion-body">
                      <div className="cabinet__col-list cabinet__col-list--past">
                        {pastFilledActivities.length === 0 ? (
                          <div className="no-activities">Нет прошедших с заполненным отчетом</div>
                        ) : (
                          pastFilledActivities.map((activity) => (
                            <CabinetEventCard
                              key={activity.id}
                              activity={activity}
                              onReportClick={onReportClick}
                              showReportStatus
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </section>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="cabinet__quick-nav cabinet__quick-nav--up"
        onClick={handleQuickNavigation}
        title="Вернуться наверх"
        aria-label="Вернуться наверх"
      >
        <span className="cabinet__quick-nav-icon" aria-hidden="true">
          <ArrowUp size={14} />
        </span>
        <span className="cabinet__quick-nav-label">Наверх</span>
      </button>
    </div>
  );
}

export default PersonalCabinet;

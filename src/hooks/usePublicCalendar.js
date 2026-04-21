import { useMemo } from 'react';
import { isPublicActivity } from '../auth/accessPolicy';
import { MONTHS, formatDate, parseDate } from '../utils/dateUtils';

export const CALENDAR_VIEW_MODES = {
  MONTH: 'month',
  WEEK: 'week',
  LIST: 'list',
};

function sortActivitiesByTime(activities) {
  return [...activities].sort((left, right) => {
    const timeComparison = (left.time || '').localeCompare(right.time || '');

    if (timeComparison !== 0) {
      return timeComparison;
    }

    return (left.person || left.name || '').localeCompare(right.person || right.name || '');
  });
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

export function usePublicCalendar({
  activities,
  currentYear,
  currentMonth,
  selectedDay,
  calendarViewMode,
  calendarSearchQuery,
  calendarPersonFilter,
  calendarTypeFilter,
  calendarObjectFilter,
}) {
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

  return {
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
  };
}
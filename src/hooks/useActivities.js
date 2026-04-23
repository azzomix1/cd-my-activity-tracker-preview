import { useState, useEffect, useCallback } from 'react';
import {
  createActivityInApi,
  deleteActivityInApi,
  fetchActivitiesFromApi,
  fetchPublicActivitiesFromApi,
  isActivitiesApiConfigured,
  normalizeActivity,
  updateActivityInApi,
} from '../services/activitiesApi';
import { isPrivateActivity, isPublicActivity } from '../auth/accessPolicy';

/**
 * Генерирует client-side ID для новой активности до записи в API.
 * @returns {string} Псевдоуникальный идентификатор.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Преобразует дату `DD.MM.YYYY` в ключ сортировки `YYYY-MM-DD`.
 * @param {string} dateString Дата в формате `DD.MM.YYYY`.
 * @returns {string} Ключ для лексикографической сортировки дат.
 */
function getDateSortValue(dateString) {
  const parts = dateString.split('.');

  if (parts.length !== 3) {
    return '';
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Сортирует активности по дате, времени и названию.
 * @param {import('../services/activitiesApi').Activity[]} activities Массив активностей.
 * @returns {import('../services/activitiesApi').Activity[]} Новый отсортированный массив.
 */
function sortActivities(activities) {
  return [...activities].sort((left, right) => {
    const dateComparison = getDateSortValue(left.date).localeCompare(getDateSortValue(right.date));

    if (dateComparison !== 0) {
      return dateComparison;
    }

    const timeComparison = (left.time || '').localeCompare(right.time || '');

    if (timeComparison !== 0) {
      return timeComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

/**
 * Возвращает единый текст ошибки при отсутствии конфигурации API.
 * @returns {string} Текст ошибки конфигурации.
 */
function getApiConfigurationError() {
  return 'Не задан адрес API для источника данных.';
}

/**
 * Хук управления активностями: загрузка, фильтрация по датам и CRUD через backend API.
 *
 * @returns {{
 * activities: import('../services/activitiesApi').Activity[],
 * isLoading: boolean,
 * isSaving: boolean,
 * syncError: string,
 * getActivitiesForMonth: (year: number, month: number) => Record<number, import('../services/activitiesApi').Activity[]>,
 * getActivitiesForDate: (year: number, month: number, day: number) => import('../services/activitiesApi').Activity[],
 * addActivity: (activityData: Partial<import('../services/activitiesApi').Activity>) => Promise<{success: boolean, id?: string, error?: string}>,
 * updateActivity: (activityData: import('../services/activitiesApi').Activity) => Promise<{success: boolean, error?: string}>,
 * deleteActivity: (id: string|number) => Promise<{success: boolean, error?: string}>,
 * getUniqueValues: (field: 'name'|'person'|'objects') => string[]
 * }}
 */
export function useActivities({ isAuthenticated = false } = {}) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadActivities() {
      setIsLoading(true);

      if (!isActivitiesApiConfigured()) {
        if (isMounted) {
          setActivities([]);
          setSyncError(getApiConfigurationError());
          setIsLoading(false);
        }
        return;
      }

      try {
        const remoteActivities = isAuthenticated
          ? await fetchActivitiesFromApi()
          : await fetchPublicActivitiesFromApi();

        if (!isMounted) {
          return;
        }

        setActivities(sortActivities(remoteActivities));
        setSyncError('');
      } catch (error) {
        console.error('Ошибка загрузки активностей:', error);

        if (!isMounted) {
          return;
        }

        setActivities([]);
        setSyncError(error.message || 'Не удалось загрузить данные из API.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadActivities();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const getActivitiesForMonth = useCallback((year, month) => {
    const result = {};

    activities.forEach((activity) => {
      if (isPrivateActivity(activity)) {
        return;
      }

      if (!activity.date) {
        return;
      }

      const parts = activity.date.split('.');
      if (parts.length !== 3) {
        return;
      }

      const actYear = parseInt(parts[2], 10);
      const actMonth = parseInt(parts[1], 10) - 1;
      const actDay = parseInt(parts[0], 10);

      if (actYear === year && actMonth === month) {
        if (!result[actDay]) {
          result[actDay] = [];
        }
        result[actDay].push(activity);
      }
    });

    Object.keys(result).forEach((day) => {
      result[day].sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    });

    return result;
  }, [activities]);

  const getActivitiesForDate = useCallback((year, month, day) => {
    const dateStr = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;

    return activities
      .filter((activity) => activity.date === dateStr && isPublicActivity(activity))
      .sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
  }, [activities]);

  const addActivity = useCallback((activityData) => {
    if (!isAuthenticated) {
      const error = 'Требуется авторизация для изменения данных.';
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    if (!isActivitiesApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    const newActivity = normalizeActivity({
      ...activityData,
      id: activityData.id || generateId(),
    });

    setIsSaving(true);

    return createActivityInApi(newActivity)
      .then((createdActivity) => {
        setActivities((prev) => sortActivities([...prev, createdActivity]));
        setSyncError('');
        return { success: true, id: createdActivity.id };
      })
      .catch((error) => {
        console.error('Ошибка сохранения активности:', error);
        setSyncError(error.message || 'Не удалось сохранить данные в API.');
        return { success: false, error: error.message || 'Не удалось сохранить данные в API.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isAuthenticated]);

  const updateActivity = useCallback((activityData) => {
    if (!isAuthenticated) {
      const error = 'Требуется авторизация для изменения данных.';
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    if (!isActivitiesApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    const normalizedActivity = normalizeActivity(activityData);

    setIsSaving(true);

    return updateActivityInApi(normalizedActivity)
      .then((updatedActivity) => {
        setActivities((prev) => sortActivities(
          prev.map((activity) => (
            activity.id === updatedActivity.id ? updatedActivity : activity
          )),
        ));
        setSyncError('');
        return { success: true };
      })
      .catch((error) => {
        console.error('Ошибка обновления активности:', error);
        setSyncError(error.message || 'Не удалось обновить данные в API.');
        return { success: false, error: error.message || 'Не удалось обновить данные в API.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isAuthenticated]);

  const deleteActivity = useCallback((id) => {
    if (!isAuthenticated) {
      const error = 'Требуется авторизация для изменения данных.';
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    if (!isActivitiesApiConfigured()) {
      const error = getApiConfigurationError();
      setSyncError(error);
      return Promise.resolve({ success: false, error });
    }

    setIsSaving(true);

    return deleteActivityInApi(id)
      .then(() => {
        setActivities((prev) => prev.filter((activity) => activity.id !== id));
        setSyncError('');
        return { success: true };
      })
      .catch((error) => {
        console.error('Ошибка удаления активности:', error);
        setSyncError(error.message || 'Не удалось удалить данные из API.');
        return { success: false, error: error.message || 'Не удалось удалить данные из API.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isAuthenticated]);

  const getUniqueValues = useCallback((field) => {
    const values = activities
      .flatMap((activity) => {
        const rawValue = activity[field];

        if (!rawValue || !String(rawValue).trim()) {
          return [];
        }

        if (field !== 'objects') {
          return [String(rawValue).trim()];
        }

        return String(rawValue)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      });

    return [...new Set(values)].sort();
  }, [activities]);

  return {
    activities,
    isLoading,
    isSaving,
    syncError,
    getActivitiesForMonth,
    getActivitiesForDate,
    addActivity,
    updateActivity,
    deleteActivity,
    getUniqueValues,
  };
}
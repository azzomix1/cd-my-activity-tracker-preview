import { useState, useEffect, useCallback } from 'react';
import {
  createActivityInApi,
  deleteActivityInApi,
  fetchActivitiesFromApi,
  isSheetsApiConfigured,
  normalizeActivity,
  updateActivityInApi,
} from '../services/activitiesApi';

const STORAGE_KEY = 'activity-tracker-data';

// Генерация уникального ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getDateSortValue(dateString) {
  const parts = dateString.split('.');

  if (parts.length !== 3) {
    return '';
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

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

// Загрузка данных из localStorage
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed)
      ? sortActivities(parsed.map(normalizeActivity))
      : [];
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    return [];
  }
}

// Сохранение данных в localStorage
function saveToStorage(activities) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortActivities(activities)));
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

export function useActivities() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [storageMode, setStorageMode] = useState(
    isSheetsApiConfigured() ? 'google-sheets' : 'local'
  );

  // Загрузка при инициализации
  useEffect(() => {
    let isMounted = true;

    async function loadActivities() {
      setIsLoading(true);

      if (!isSheetsApiConfigured()) {
        if (!isMounted) {
          return;
        }

        setActivities(loadFromStorage());
        setStorageMode('local');
        setSyncError('');
        setIsLoading(false);
        return;
      }

      try {
        const remoteActivities = await fetchActivitiesFromApi();

        if (!isMounted) {
          return;
        }

        setActivities(sortActivities(remoteActivities));
        setStorageMode('google-sheets');
        setSyncError('');
      } catch (error) {
        console.error('Ошибка загрузки из Google Sheets:', error);

        if (!isMounted) {
          return;
        }

        setActivities(loadFromStorage());
        setStorageMode('local');
        setSyncError('Не удалось загрузить данные из Google Sheets. Используется локальная копия браузера.');
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
  }, []);

  // Сохранение при изменении
  useEffect(() => {
    if (!isLoading) {
      saveToStorage(activities);
    }
  }, [activities, isLoading]);

  // Получить активности для конкретного месяца
  const getActivitiesForMonth = useCallback((year, month) => {
    const result = {};
    
    activities.forEach(activity => {
      if (!activity.date) return;
      
      const parts = activity.date.split('.');
      if (parts.length !== 3) return;
      
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

    // Сортировка по времени
    Object.keys(result).forEach(day => {
      result[day].sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
    });

    return result;
  }, [activities]);

  // Получить активности для конкретной даты
  const getActivitiesForDate = useCallback((year, month, day) => {
    const dateStr = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
    
    return activities
      .filter(activity => activity.date === dateStr)
      .sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
      });
  }, [activities]);

  // Добавить новую активность
  const addActivity = useCallback((activityData) => {
    const newActivity = normalizeActivity({
      ...activityData,
      id: activityData.id || generateId(),
    });

    if (!isSheetsApiConfigured()) {
      setActivities(prev => sortActivities([...prev, newActivity]));
      setStorageMode('local');
      setSyncError('');
      return Promise.resolve({ success: true, id: newActivity.id, mode: 'local' });
    }

    setIsSaving(true);

    return createActivityInApi(newActivity)
      .then((createdActivity) => {
        setActivities(prev => sortActivities([...prev, createdActivity]));
        setStorageMode('google-sheets');
        setSyncError('');
        return { success: true, id: createdActivity.id, mode: 'google-sheets' };
      })
      .catch((error) => {
        console.error('Ошибка сохранения в Google Sheets:', error);
        setStorageMode('local');
        setSyncError(error.message || 'Не удалось сохранить данные в Google Sheets.');
        return { success: false, error: error.message || 'Не удалось сохранить данные в Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  // Обновить активность
  const updateActivity = useCallback((activityData) => {
    const normalizedActivity = normalizeActivity(activityData);

    if (!isSheetsApiConfigured()) {
      setActivities(prev => sortActivities(
        prev.map(activity =>
          activity.id === normalizedActivity.id ? normalizedActivity : activity
        )
      ));
      setStorageMode('local');
      setSyncError('');
      return Promise.resolve({ success: true, mode: 'local' });
    }

    setIsSaving(true);

    return updateActivityInApi(normalizedActivity)
      .then((updatedActivity) => {
        setActivities(prev => sortActivities(
          prev.map(activity =>
            activity.id === updatedActivity.id ? updatedActivity : activity
          )
        ));
        setStorageMode('google-sheets');
        setSyncError('');
        return { success: true, mode: 'google-sheets' };
      })
      .catch((error) => {
        console.error('Ошибка обновления в Google Sheets:', error);
        setStorageMode('local');
        setSyncError(error.message || 'Не удалось обновить данные в Google Sheets.');
        return { success: false, error: error.message || 'Не удалось обновить данные в Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  // Удалить активность
  const deleteActivity = useCallback((id) => {
    if (!isSheetsApiConfigured()) {
      setActivities(prev => prev.filter(activity => activity.id !== id));
      setStorageMode('local');
      setSyncError('');
      return Promise.resolve({ success: true, mode: 'local' });
    }

    setIsSaving(true);

    return deleteActivityInApi(id)
      .then(() => {
        setActivities(prev => prev.filter(activity => activity.id !== id));
        setStorageMode('google-sheets');
        setSyncError('');
        return { success: true, mode: 'google-sheets' };
      })
      .catch((error) => {
        console.error('Ошибка удаления из Google Sheets:', error);
        setStorageMode('local');
        setSyncError(error.message || 'Не удалось удалить данные из Google Sheets.');
        return { success: false, error: error.message || 'Не удалось удалить данные из Google Sheets.' };
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, []);

  // Получить уникальные значения для автодополнения
  const getUniqueValues = useCallback((field) => {
    const values = activities
      .map(activity => activity[field])
      .filter(value => value && value.trim());
    
    return [...new Set(values)].sort();
  }, [activities]);

  return {
    activities,
    isLoading,
    isSaving,
    syncError,
    storageMode,
    getActivitiesForMonth,
    getActivitiesForDate,
    addActivity,
    updateActivity,
    deleteActivity,
    getUniqueValues
  };
}
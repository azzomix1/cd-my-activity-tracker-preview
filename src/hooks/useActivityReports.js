import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteReportDraftFromApi,
  fetchReportsSnapshotFromApi,
  normalizeReportData,
  normalizeReportDraftData,
  saveReportDraftToApi,
  saveReportToApi,
} from '../services/reportsApi';

const DRAFT_SYNC_DELAY_MS = 500;

function cloneTimers(timers) {
  return Array.from(timers.values());
}

export function useActivityReports() {
  const [reportsByActivityId, setReportsByActivityId] = useState({});
  const [reportDraftsByActivityId, setReportDraftsByActivityId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState('');
  const draftTimersRef = useRef(new Map());

  useEffect(() => {
    let isMounted = true;

    async function loadReportState() {
      setIsLoading(true);

      try {
        const snapshot = await fetchReportsSnapshotFromApi();

        if (!isMounted) {
          return;
        }

        setReportsByActivityId(snapshot.reportsByActivityId);
        setReportDraftsByActivityId(snapshot.draftsByActivityId);
        setSyncError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSyncError(error.message || 'Не удалось загрузить отчеты из API.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReportState();

    return () => {
      isMounted = false;

      cloneTimers(draftTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });

      draftTimersRef.current.clear();
    };
  }, []);

  const saveReport = useCallback(async (activityId, reportData) => {
    const normalizedReport = normalizeReportData({
      ...reportData,
      updatedAt: new Date().toISOString(),
    });

    const pendingTimerId = draftTimersRef.current.get(activityId);
    if (pendingTimerId) {
      window.clearTimeout(pendingTimerId);
      draftTimersRef.current.delete(activityId);
    }

    setIsSaving(true);

    try {
      const savedReport = await saveReportToApi(activityId, normalizedReport);
      await deleteReportDraftFromApi(activityId);

      setReportsByActivityId((prev) => ({
        ...prev,
        [activityId]: savedReport,
      }));

      setReportDraftsByActivityId((prev) => {
        if (!(activityId in prev)) {
          return prev;
        }

        const nextDrafts = { ...prev };
        delete nextDrafts[activityId];
        return nextDrafts;
      });

      setSyncError('');
      return { success: true, item: savedReport };
    } catch (error) {
      setSyncError(error.message || 'Не удалось сохранить отчет в API.');
      return { success: false, error: error.message || 'Не удалось сохранить отчет в API.' };
    } finally {
      setIsSaving(false);
    }
  }, []);

  const upsertDraft = useCallback(async (activityId, draftData) => {
    const normalizedDraft = normalizeReportDraftData({
      ...draftData,
      updatedAt: new Date().toISOString(),
    });

    try {
      const savedDraft = await saveReportDraftToApi(activityId, normalizedDraft);
      setReportDraftsByActivityId((prev) => ({
        ...prev,
        [activityId]: savedDraft,
      }));
      setSyncError('');
      return { success: true, item: savedDraft };
    } catch (error) {
      setSyncError(error.message || 'Не удалось сохранить черновик отчета.');
      return { success: false, error: error.message || 'Не удалось сохранить черновик отчета.' };
    }
  }, []);

  const queueDraftChange = useCallback((activityId, draftData) => {
    const normalizedActivityId = String(activityId || '').trim();

    if (!normalizedActivityId) {
      return;
    }

    const pendingTimerId = draftTimersRef.current.get(normalizedActivityId);
    if (pendingTimerId) {
      window.clearTimeout(pendingTimerId);
      draftTimersRef.current.delete(normalizedActivityId);
    }

    if (!draftData) {
      setReportDraftsByActivityId((prev) => {
        if (!(normalizedActivityId in prev)) {
          return prev;
        }

        const nextDrafts = { ...prev };
        delete nextDrafts[normalizedActivityId];
        return nextDrafts;
      });

      const timerId = window.setTimeout(async () => {
        draftTimersRef.current.delete(normalizedActivityId);

        try {
          await deleteReportDraftFromApi(normalizedActivityId);
          setSyncError('');
        } catch (error) {
          setSyncError(error.message || 'Не удалось удалить черновик отчета.');
        }
      }, DRAFT_SYNC_DELAY_MS);

      draftTimersRef.current.set(normalizedActivityId, timerId);

      return;
    }

    const normalizedDraft = normalizeReportDraftData({
      ...draftData,
      updatedAt: new Date().toISOString(),
    });

    setReportDraftsByActivityId((prev) => ({
      ...prev,
      [normalizedActivityId]: normalizedDraft,
    }));

    const timerId = window.setTimeout(async () => {
      draftTimersRef.current.delete(normalizedActivityId);
      await upsertDraft(normalizedActivityId, normalizedDraft);
    }, DRAFT_SYNC_DELAY_MS);

    draftTimersRef.current.set(normalizedActivityId, timerId);
  }, [upsertDraft]);

  const discardDraft = useCallback(async (activityId) => {
    const normalizedActivityId = String(activityId || '').trim();

    if (!normalizedActivityId) {
      return { success: false, error: 'Activity id is required.' };
    }

    const pendingTimerId = draftTimersRef.current.get(normalizedActivityId);
    if (pendingTimerId) {
      window.clearTimeout(pendingTimerId);
      draftTimersRef.current.delete(normalizedActivityId);
    }

    setReportDraftsByActivityId((prev) => {
      if (!(normalizedActivityId in prev)) {
        return prev;
      }

      const nextDrafts = { ...prev };
      delete nextDrafts[normalizedActivityId];
      return nextDrafts;
    });

    try {
      await deleteReportDraftFromApi(normalizedActivityId);
      setSyncError('');
      return { success: true };
    } catch (error) {
      setSyncError(error.message || 'Не удалось удалить черновик отчета.');
      return { success: false, error: error.message || 'Не удалось удалить черновик отчета.' };
    }
  }, []);

  return {
    reportsByActivityId,
    reportDraftsByActivityId,
    isLoading,
    isSaving,
    syncError,
    saveReport,
    upsertDraft,
    queueDraftChange,
    discardDraft,
  };
}
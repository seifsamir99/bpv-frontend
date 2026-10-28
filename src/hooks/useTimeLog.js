import { useState, useEffect, useCallback } from 'react';
import timeEntriesApi from '../services/timeEntriesApi';

export function useTimeLog(year, month, employeeId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await timeEntriesApi.getAll(year, month, employeeId);
      if (response.success) {
        setEntries(response.data);
      } else {
        setError(response.error || 'Failed to fetch time entries');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch time entries');
    } finally {
      setLoading(false);
    }
  }, [year, month, employeeId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const updateEntry = async (entryId, checkInAt, checkOutAt, note = null) => {
    try {
      const response = await timeEntriesApi.update(entryId, checkInAt, checkOutAt, note);
      if (response.success) {
        // Merge (not replace) — the PUT response omits employee name/designation/type
        setEntries(prev => prev.map(e => (e.id === entryId ? { ...e, ...response.data } : e)));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Wipes an entry entirely — since the month view only lists real entries,
  // a reset one just disappears from the list (the day is blank again).
  const resetEntry = async (entryId) => {
    try {
      const response = await timeEntriesApi.reset(entryId);
      if (response.success) {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return { entries, loading, error, refresh: fetchEntries, updateEntry, resetEntry };
}

export default useTimeLog;

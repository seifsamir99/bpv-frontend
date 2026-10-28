import { useState, useEffect, useCallback } from 'react';
import timeEntriesApi from '../services/timeEntriesApi';

// Full employee roster for a single day — includes employees who haven't
// checked in yet, so the office can mark them Absent instead of leaving a blank.
export function useDayLog(date, employeeId) {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await timeEntriesApi.getDay(date, employeeId);
      if (response.success) {
        setRoster(response.data);
      } else {
        setError(response.error || 'Failed to fetch day log');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch day log');
    } finally {
      setLoading(false);
    }
  }, [date, employeeId]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  // status: 'absent' | 'sick' | null (null clears it)
  const setStatus = async (targetEmployeeId, status, note = null) => {
    try {
      const response = await timeEntriesApi.setStatus(targetEmployeeId, date, status, note);
      if (response.success) {
        setRoster(prev => prev.map(r => (
          r.employeeId === targetEmployeeId
            ? { ...r, status: response.data.status, note: response.data.note, entryId: response.data.id }
            : r
        )));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateEntry = async (entryId, checkInAt, checkOutAt, note = null) => {
    try {
      const response = await timeEntriesApi.update(entryId, checkInAt, checkOutAt, note);
      if (response.success) {
        setRoster(prev => prev.map(r => (
          r.entryId === entryId ? { ...r, ...response.data } : r
        )));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Admin creates a day's entry from scratch — no GPS involved — for when
  // the engineer can't self check-in (e.g. location permission stuck denied).
  const manualCheckIn = async (targetEmployeeId, checkInAt, checkOutAt, note = null) => {
    try {
      const response = await timeEntriesApi.manualCheckIn(targetEmployeeId, date, checkInAt, checkOutAt, note);
      if (response.success) {
        setRoster(prev => prev.map(r => (
          r.employeeId === targetEmployeeId ? { ...r, ...response.data } : r
        )));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Wipes a day's entry entirely (check-in/out, status, note) so the
  // employee can start fresh — e.g. they tapped the wrong button.
  const resetEntry = async (entryId) => {
    try {
      const response = await timeEntriesApi.reset(entryId);
      if (response.success) {
        setRoster(prev => prev.map(r => (
          r.entryId === entryId
            ? {
                ...r, entryId: null, checkInAt: null, checkOutAt: null,
                checkInLat: null, checkInLng: null, checkOutLat: null, checkOutLng: null,
                status: null, note: null, earlyLeave: false,
              }
            : r
        )));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return { roster, loading, error, refresh: fetchRoster, setStatus, updateEntry, resetEntry, manualCheckIn };
}

export default useDayLog;

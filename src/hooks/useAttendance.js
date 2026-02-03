import { useState, useEffect, useCallback } from 'react';
import attendanceApi from '../services/attendanceApi';

export function useAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await attendanceApi.getAll();
      if (response.success) {
        setAttendance(response.data);
      } else {
        setError(response.error || 'Failed to fetch attendance');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const updateAttendance = async (employeeId, day, status) => {
    try {
      const response = await attendanceApi.update(employeeId, day, status);
      if (response.success) {
        // Update local state
        setAttendance(prev => prev.map(record => {
          if (record.employeeId === employeeId) {
            return {
              ...record,
              days: { ...record.days, [day]: status }
            };
          }
          return record;
        }));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const bulkUpdateAttendance = async (day, updates) => {
    try {
      const response = await attendanceApi.bulkUpdate(day, updates);
      if (response.success) {
        // Update local state
        setAttendance(prev => prev.map(record => {
          const update = updates.find(u => u.employeeId === record.employeeId);
          if (update) {
            return {
              ...record,
              days: { ...record.days, [day]: update.status }
            };
          }
          return record;
        }));
        return response;
      }
      return { success: false, error: response.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Mark all employees with a specific status for a day
  const markAllAs = async (day, status) => {
    const updates = attendance.map(record => ({
      employeeId: record.employeeId,
      status
    }));
    return bulkUpdateAttendance(day, updates);
  };

  return {
    attendance,
    loading,
    error,
    refresh: fetchAttendance,
    updateAttendance,
    bulkUpdateAttendance,
    markAllAs,
  };
}

export default useAttendance;

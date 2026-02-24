import { useState, useEffect, useCallback } from 'react';
import attendanceApi from '../services/attendanceApi';

export function useAttendance(type = 'all', month, year) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await attendanceApi.getAll(type, month, year);
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
  }, [type, month, year]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const updateAttendance = async (employeeId, day, status, employeeType) => {
    try {
      const response = await attendanceApi.update(employeeId, day, status, employeeType || 'labour', month, year);
      if (response.success) {
        setAttendance(prev => prev.map(record => {
          if (record.employeeId === employeeId) {
            return { ...record, days: { ...record.days, [day]: status } };
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

  const bulkUpdateAttendance = async (day, updates, bulkType) => {
    try {
      const response = await attendanceApi.bulkUpdate(day, updates, bulkType || 'all', month, year);
      if (response.success) {
        setAttendance(prev => prev.map(record => {
          const update = updates.find(u => u.employeeId === record.employeeId);
          if (update) {
            return { ...record, days: { ...record.days, [day]: update.status } };
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

  // Mark all filtered employees with a specific status for a day
  const markAllAs = async (day, updates) => {
    return bulkUpdateAttendance(day, updates, 'all');
  };

  // Auto-fill Sundays as "Off" for all employees with empty cells
  const autoFillSundays = useCallback(async (targetYear, targetMonth) => {
    if (attendance.length === 0) return;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const sundays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(targetYear, targetMonth, d).getDay() === 0) sundays.push(d);
    }

    // Collect updates grouped by day — force Off for any Sunday not already Off
    const updatesByDay = {};
    for (const sunday of sundays) {
      for (const record of attendance) {
        if (record.days?.[sunday]?.toLowerCase() !== 'off') {
          if (!updatesByDay[sunday]) updatesByDay[sunday] = [];
          updatesByDay[sunday].push({
            employeeId: record.employeeId,
            status: 'Off',
            type: record.type || 'labour'
          });
        }
      }
    }

    const dayKeys = Object.keys(updatesByDay);
    if (dayKeys.length === 0) return;

    // Send all Sunday updates in parallel - pass month/year to API
    await Promise.all(
      dayKeys.map(day =>
        attendanceApi.bulkUpdate(parseInt(day), updatesByDay[day], 'all', targetMonth, targetYear)
      )
    );

    // Update local state — force all Sundays to Off
    setAttendance(prev => prev.map(record => {
      const updatedDays = { ...record.days };
      for (const sunday of sundays) {
        updatedDays[sunday] = 'Off';
      }
      return { ...record, days: updatedDays };
    }));
  }, [attendance]);

  return {
    attendance,
    loading,
    error,
    refresh: fetchAttendance,
    updateAttendance,
    bulkUpdateAttendance,
    markAllAs,
    autoFillSundays,
  };
}

export default useAttendance;

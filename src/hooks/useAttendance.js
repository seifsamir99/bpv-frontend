import { useState, useEffect, useCallback } from 'react';
import attendanceApi from '../services/attendanceApi';

// Cancelled/Resigned cut-off, kept in step with the optimistic local edits
// below. The authoritative value is derived server-side across EVERY month
// (_end_dates in employee_attendance_service.py); here we only re-derive what
// the month on screen says, so the badge and the payroll cut-off react to a
// click without paying for a refetch.
const TERMINAL_STATUSES = ['resigned', 'cancelled'];

function terminalDayIn(record, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const v = (record.days?.[d] ?? '').toString().trim().toLowerCase();
    if (TERMINAL_STATUSES.includes(v)) {
      return { day: d, reason: v === 'resigned' ? 'Resigned' : 'Cancelled' };
    }
  }
  return null;
}

function recomputeEnd(record, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const [endYear, endMonth] = (record.endDate || '').split('-').map(Number);
  const hasEnd = !!record.endDate;
  const endsBefore = hasEnd && (endYear < year || (endYear === year && endMonth < month + 1));
  const endsAfter = hasEnd && (endYear > year || (endYear === year && endMonth > month + 1));

  // An end date set in an EARLIER month can't be changed from this month's grid.
  if (endsBefore) return { ...record, cutoffDay: 0 };

  const local = terminalDayIn(record, year, month);
  if (local) {
    return {
      ...record,
      endDate: `${year}-${pad(month + 1)}-${pad(local.day)}`,
      endReason: local.reason,
      cutoffDay: local.day,
    };
  }
  // Nothing terminal left in this month: a LATER month's end date still
  // stands, this month's own marking is gone.
  return endsAfter
    ? { ...record, cutoffDay: null }
    : { ...record, endDate: null, endReason: null, cutoffDay: null };
}

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
            return recomputeEnd({ ...record, days: { ...record.days, [day]: status } }, year, month);
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
            return recomputeEnd({ ...record, days: { ...record.days, [day]: update.status } }, year, month);
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

  // Mark all non-Sunday days in the month for a single employee
  const markEmployeeAllDays = async (employeeId, status, employeeType) => {
    try {
      const response = await attendanceApi.markAllDays(employeeId, status, employeeType || 'labour', month, year);
      if (response.success) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        setAttendance(prev => prev.map(record => {
          if (record.employeeId !== employeeId) return record;
          const updatedDays = { ...record.days };
          for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(year, month, d).getDay() !== 0) {
              updatedDays[d] = status;
            }
          }
          return recomputeEnd({ ...record, days: updatedDays }, year, month);
        }));
      }
      return response;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Mark all non-Sunday days in the month for a set of employees in ONE atomic
  // request. employeeIds limits the update to exactly those employees (respects
  // the current UI filters), so it can never partially apply like N parallel calls.
  const markAllEmployeesAllDays = async (employeeIds, status) => {
    try {
      const response = await attendanceApi.markAllDaysAllEmployees(status, employeeIds, 'all', month, year);
      if (!response.success) {
        return { success: false, error: response.error || 'Failed to update' };
      }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const idSet = new Set(employeeIds);
      setAttendance(prev => prev.map(record => {
        if (!idSet.has(record.employeeId)) return record;
        const updatedDays = { ...record.days };
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, month, d).getDay() !== 0) {
            updatedDays[d] = status;
          }
        }
        return recomputeEnd({ ...record, days: updatedDays }, year, month);
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Fill Sundays as "Off" — but ONLY where the cell is still empty. Sunday is a
  // default, not a rule: the office must be able to mark a Sunday Leave/Absent
  // (a man on leave should not be paid for the Sundays inside it — Off counts
  // as paid in payrollCalculation.js, Leave does not). Overwriting anything
  // non-empty here would silently undo those edits on the next page load.
  const autoFillSundays = useCallback(async (targetYear, targetMonth) => {
    if (attendance.length === 0) return;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const sundays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(targetYear, targetMonth, d).getDay() === 0) sundays.push(d);
    }

    const isEmpty = (v) => !v || !v.toString().trim();

    const updatesByDay = {};
    for (const sunday of sundays) {
      for (const record of attendance) {
        if (isEmpty(record.days?.[sunday])) {
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

    // Mirror locally — again only the cells that were actually empty
    setAttendance(prev => prev.map(record => {
      const updatedDays = { ...record.days };
      for (const sunday of sundays) {
        if (isEmpty(updatedDays[sunday])) updatedDays[sunday] = 'Off';
      }
      return { ...record, days: updatedDays };
    }));
  }, [attendance]);

  // Set one status across a span of days (a leave period, a shutdown).
  // employeeIds limits it to the rows currently on screen; Sundays are included
  // unless explicitly excluded.
  const markRange = async (fromDay, toDay, status, employeeIds, includeSundays = true) => {
    try {
      const res = await attendanceApi.markRange(
        fromDay, toDay, status, employeeIds, type || 'all', month, year, includeSundays);
      if (res.success) {
        const lo = Math.min(fromDay, toDay);
        const hi = Math.max(fromDay, toDay);
        const ids = new Set((employeeIds || []).map(String));
        setAttendance(prev => prev.map(record => {
          if (ids.size && !ids.has(String(record.employeeId))) return record;
          const updatedDays = { ...record.days };
          for (let d = lo; d <= hi; d++) {
            const isSun = new Date(year, month, d).getDay() === 0;
            if (!includeSundays && isSun) continue;
            updatedDays[d] = status;
          }
          return recomputeEnd({ ...record, days: updatedDays }, year, month);
        }));
        return { success: true, message: res.message };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return {
    attendance,
    loading,
    error,
    refresh: fetchAttendance,
    updateAttendance,
    bulkUpdateAttendance,
    markAllAs,
    markEmployeeAllDays,
    markAllEmployeesAllDays,
    markRange,
    autoFillSundays,
  };
}

export default useAttendance;

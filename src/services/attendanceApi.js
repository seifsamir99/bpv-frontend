import axios from 'axios';

import { API_BASE as API_BASE_URL } from './apiBase';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const attendanceApi = {
  // Get attendance records, optionally filtered by type, month, and year
  getAll: async (type = 'all', month, year) => {
    const response = await api.get('/attendance', { params: { type, month, year } });
    return response.data;
  },

  // Update attendance for a specific employee and day
  update: async (employeeId, day, status, type = 'labour', month, year) => {
    const response = await api.put(`/attendance/${employeeId}/${day}`, { status, type, month, year });
    return response.data;
  },

  // Bulk update attendance for multiple employees on a specific day
  bulkUpdate: async (day, updates, type = 'all', month, year) => {
    const response = await api.post('/attendance/bulk', { day, updates, type, month, year });
    return response.data;
  },

  // Mark all non-Sunday days in the month for a single employee
  markAllDays: async (employeeId, status, type, month, year) => {
    const response = await api.post('/attendance/bulk-all-days', { employeeId, status, type, month, year });
    return response.data;
  },

  // Mark all non-Sunday days in the month for many employees in one atomic query.
  // employeeIds (optional) limits to those employees (respects UI filters).
  markAllDaysAllEmployees: async (status, employeeIds, type, month, year) => {
    const response = await api.post('/attendance/bulk-all-days-all', { status, employeeIds, type, month, year });
    return response.data;
  },

  // Set one status from day X to day Y (a leave period, a shutdown).
  // Sundays are included unless includeSundays is false.
  markRange: async (fromDay, toDay, status, employeeIds, type, month, year, includeSundays = true) => {
    const response = await api.post('/attendance/bulk-range', {
      fromDay, toDay, status, employeeIds, type, month, year, includeSundays,
    });
    return response.data;
  },
};

export default attendanceApi;
// Force rebuild 24 Feb 2026 12:10:46

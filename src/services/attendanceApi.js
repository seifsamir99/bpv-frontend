import axios from 'axios';

const API_BASE_URL = 'https://bpv-backend-production.up.railway.app/api';

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
};

export default attendanceApi;

import axios from 'axios';

const API_BASE_URL = 'https://bpv-backend-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const attendanceApi = {
  // Get all attendance records
  getAll: async () => {
    const response = await api.get('/attendance');
    return response.data;
  },

  // Update attendance for a specific employee and day
  update: async (employeeId, day, status) => {
    const response = await api.put(`/attendance/${employeeId}/${day}`, { status });
    return response.data;
  },

  // Bulk update attendance for multiple employees on a specific day
  bulkUpdate: async (day, updates) => {
    const response = await api.post('/attendance/bulk', { day, updates });
    return response.data;
  },
};

export default attendanceApi;

import axios from 'axios';

const API_BASE_URL = 'https://bpv-backend-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const employeeApi = {
  // Get all employees (optionally filter by type: 'labour' or 'staff')
  getAll: async (type = null) => {
    const params = type ? { type } : {};
    const response = await api.get('/employees', { params });
    return response.data;
  },

  // Get single employee by ID
  getById: async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  // Get next available Employee ID
  getNextId: async (type = 'labour') => {
    const response = await api.get('/employees/next-id', { params: { type } });
    return response.data;
  },

  // Create new employee
  create: async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    return response.data;
  },

  // Update employee
  update: async (id, employeeData) => {
    const response = await api.put(`/employees/${id}`, employeeData);
    return response.data;
  },

  // Delete employee
  delete: async (id) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },

  // Update OT hours for an employee
  updateOT: async (id, otHours) => {
    const response = await api.put(`/employees/${id}/ot`, { otHours });
    return response.data;
  },

  // Bulk update OT hours for multiple employees
  bulkUpdateOT: async (updates) => {
    const response = await api.post('/employees/ot/bulk', { updates });
    return response.data;
  },

  // Move employee between Labour and Staff
  move: async (id, targetType) => {
    const response = await api.post(`/employees/${id}/move`, { targetType });
    return response.data;
  },
};

export default employeeApi;

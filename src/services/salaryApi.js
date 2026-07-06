import axios from 'axios';

// TODO: Update this URL when salary backend is ready
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const salaryApi = {
  // Get all salaries
  getAll: async () => {
    // TODO: Replace with actual endpoint when backend is ready
    // const response = await api.get('/salaries');
    // return response.data;

    // For now, return empty array (frontend-only mode)
    return [];
  },

  // Get single salary by ID
  getById: async (id) => {
    const response = await api.get(`/salaries/${id}`);
    return response.data;
  },

  // Create new salary
  create: async (salaryData) => {
    // TODO: Replace with actual endpoint when backend is ready
    // const response = await api.post('/salaries', salaryData);
    // return response.data;

    // For now, simulate success
    console.log('Would create salary:', salaryData);
    return { success: true, data: { ...salaryData, id: Date.now() } };
  },

  // Update salary
  update: async (id, salaryData) => {
    // TODO: Replace with actual endpoint when backend is ready
    // const response = await api.put(`/salaries/${id}`, salaryData);
    // return response.data;

    // For now, simulate success
    console.log('Would update salary:', id, salaryData);
    return { success: true, data: salaryData };
  },

  // Delete salary
  delete: async (id) => {
    // TODO: Replace with actual endpoint when backend is ready
    // const response = await api.delete(`/salaries/${id}`);
    // return response.data;

    // For now, simulate success
    console.log('Would delete salary:', id);
    return { success: true };
  },
};

export default salaryApi;

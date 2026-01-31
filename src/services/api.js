import axios from 'axios';

// API base URL - Railway backend
const API_BASE = 'https://bpv-backend-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// BPV API functions
export const bpvApi = {
  // Get all vouchers
  getAll: async () => {
    const response = await api.get('/bpv');
    return response.data;
  },

  // Get next available BPV number
  getNextNumber: async () => {
    const response = await api.get('/bpv/next-number');
    return response.data;
  },

  // Get single voucher
  getOne: async (bpvNo) => {
    const response = await api.get(`/bpv/${bpvNo}`);
    return response.data;
  },

  // Create new voucher
  create: async (data) => {
    const response = await api.post('/bpv', data);
    return response.data;
  },

  // Update voucher
  update: async (bpvNo, data) => {
    const response = await api.put(`/bpv/${bpvNo}`, data);
    return response.data;
  },

  // Delete voucher
  delete: async (bpvNo) => {
    const response = await api.delete(`/bpv/${bpvNo}`);
    return response.data;
  },

  // Get PDF URL (not available)
  getPdfUrl: (bpvNo) => {
    return `${API_BASE}/bpv/${bpvNo}/pdf`;
  }
};

export default api;

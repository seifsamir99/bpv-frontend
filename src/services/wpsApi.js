import axios from 'axios';

import { API_BASE as API_BASE_URL } from './apiBase';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// WPS roster: the lines of each company's bank salary-transfer file
// (MOL code, legal name, bank code, account), kept so the file can be rebuilt
// every month without uploading last month's copy.
export const wpsApi = {
  // [{ molCode, compMol, name, bankCode, accNo, employeeId }]
  getRoster: async () => {
    const response = await api.get('/wps/roster');
    return response.data.data || [];
  },

  // Replace one company's lines with those of an uploaded WPS file
  replaceCompany: async (compMol, rows) => {
    const response = await api.put(`/wps/roster/${encodeURIComponent(compMol)}`, { rows });
    return response.data;
  },

  // { [molCode]: employeeId } — '' = not in payroll
  savePairings: async (pairings) => {
    const response = await api.post('/wps/pairings', { pairings });
    return response.data;
  },
};

export default wpsApi;

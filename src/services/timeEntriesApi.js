import axios from 'axios';

import { API_BASE as API_BASE_URL } from './apiBase';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Only the owner's devices may change the Time Log. The key is saved in this
// browser once, by opening /time-log?admin=<key>, and sent on every call; the
// API refuses edits without it (see _require_time_log_admin in api.py).
const ADMIN_KEY_STORAGE = 'timeLogAdminKey';

export function saveAdminKey(key) {
  try { localStorage.setItem(ADMIN_KEY_STORAGE, key); } catch { /* storage blocked */ }
}

function readAdminKey() {
  try { return localStorage.getItem(ADMIN_KEY_STORAGE); } catch { return null; }
}

api.interceptors.request.use((config) => {
  const key = readAdminKey();
  if (key) config.headers['X-Admin-Key'] = key;
  return config;
});

// Note: the self-service check-in/out/status calls (used by engineers on
// their personal link) live in the separate bpv-checkin app now, not here —
// this app only ever needs the admin-facing Time Log calls below.
export const timeEntriesApi = {
  // Whether this browser holds the admin key (decides edit vs view-only)
  adminCheck: async () => {
    const response = await api.get('/time-entries/admin-check');
    return response.data;
  },

  // Admin Time Log
  getAll: async (year, month, employeeId) => {
    const response = await api.get('/time-entries', { params: { year, month, employeeId } });
    return response.data;
  },

  // Full employee roster for one day (includes employees with no check-in yet)
  getDay: async (date, employeeId) => {
    const response = await api.get('/time-entries/day', { params: { date, employeeId } });
    return response.data;
  },

  update: async (entryId, checkInAt, checkOutAt, note = null) => {
    const response = await api.put(`/time-entries/${entryId}`, { checkInAt, checkOutAt, note });
    return response.data;
  },

  // Admin creates a day's entry from scratch, no GPS involved — for when the
  // engineer can't self check-in (e.g. location permission stuck denied)
  manualCheckIn: async (employeeId, date, checkInAt, checkOutAt, note = null) => {
    const response = await api.post('/time-entries/manual', { employeeId, date, checkInAt, checkOutAt, note });
    return response.data;
  },

  // Admin reset: wipe a day's entry entirely (e.g. wrong tap), so the
  // employee can check in fresh
  reset: async (entryId) => {
    const response = await api.delete(`/time-entries/${entryId}`);
    return response.data;
  },

  // Admin Day view: mark (or clear, with status: null) Absent/Sick for an employee
  setStatus: async (employeeId, date, status, note = null) => {
    const response = await api.put('/time-entries/status', { employeeId, date, status, note });
    return response.data;
  },
};

export default timeEntriesApi;

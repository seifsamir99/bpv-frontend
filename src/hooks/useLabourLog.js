import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE as API_BASE_URL } from '../services/apiBase';

// The labour daily site log the engineers fill at /crew/<token> — one row per
// labour with a `days` map (1-31) of { status, otHours, sites, conflict, ... }.
// month is 0-indexed, matching useAttendance / useMonthEnd.
export function useLabourLog(month, year) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/labour-log`, { params: { month, year } });
      if (res.data.success) {
        setRows(res.data.data);
      } else {
        setError(res.data.error || 'Failed to fetch site log');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch site log');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Office correction of one logged day. The backend re-syncs the attendance
  // grid and the month's OT total, so the list is refetched afterwards.
  const updateEntry = async (entryId, changes) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/labour-log/${entryId}`, changes);
      if (res.data.success) {
        await fetchRows();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const deleteEntry = async (entryId) => {
    try {
      const res = await axios.delete(`${API_BASE_URL}/labour-log/${entryId}`);
      if (res.data.success) {
        await fetchRows();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return { rows, loading, error, refresh: fetchRows, updateEntry, deleteEntry };
}

// The project sites shown as chips on the engineers' phones. Its own list —
// NOT the LPO generator's delivery sites.
export function useLabourSites() {
  const [sites, setSites] = useState([]);

  const fetchSites = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/labour-sites`);
      if (res.data.success) setSites(res.data.sites);
    } catch {
      /* the sheet is still usable without the site list */
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const addSite = async (name) => {
    const res = await axios.post(`${API_BASE_URL}/labour-sites`, { name });
    if (res.data.success) setSites(res.data.sites);
  };

  const deleteSite = async (name) => {
    const res = await axios.delete(`${API_BASE_URL}/labour-sites`, { params: { name } });
    if (res.data.success) setSites(res.data.sites);
  };

  return { sites, addSite, deleteSite, refresh: fetchSites };
}

export default useLabourLog;

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE as API_BASE_URL } from '../services/apiBase';

// Per-month Month-End entries (OT hours + bonus/deduction adjustments).
// month is 0-indexed, matching useAttendance / the payroll API.
export function useMonthEnd(month, year) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/month-end`, { params: { month, year } });
      if (res.data.success) {
        setEntries(res.data.data);
      } else {
        setError(res.data.error || 'Failed to fetch month-end data');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch month-end data');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntries = async (updates) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/month-end/bulk`, { month, year, updates });
      if (res.data.success) {
        await fetchEntries();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return { entries, loading, error, refresh: fetchEntries, saveEntries };
}

export default useMonthEnd;

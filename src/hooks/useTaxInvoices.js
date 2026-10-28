import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE as API_BASE_URL } from '../services/apiBase';

// Per-month tax invoices (received supplier invoices, for VAT record-keeping).
// month is 0-indexed, matching useAttendance / the payroll + month-end APIs.
export function useTaxInvoices(month, year) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE_URL}/tax-invoices`, { params: { month, year } });
      if (res.data.success) {
        setInvoices(res.data.data);
      } else {
        setError(res.data.error || 'Failed to fetch tax invoices');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch tax invoices');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const add = async (invoice) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/tax-invoices`, { ...invoice, month, year });
      if (res.data.success) {
        await fetchInvoices();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const update = async (id, invoice) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/tax-invoices/${id}`, { ...invoice, month, year });
      if (res.data.success) {
        await fetchInvoices();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const remove = async (id) => {
    try {
      const res = await axios.delete(`${API_BASE_URL}/tax-invoices/${id}`);
      if (res.data.success) {
        await fetchInvoices();
        return res.data;
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  return { invoices, loading, error, refresh: fetchInvoices, add, update, remove };
}

export default useTaxInvoices;

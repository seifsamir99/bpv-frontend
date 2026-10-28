import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE as API_BASE_URL } from '../services/apiBase';

// Supplier ledger (accounts payable). Balances/ageing are derived server-side;
// the page only reads the summary or one supplier's statement and posts edits.
const BASE = `${API_BASE_URL}/supplier-ledger`;

async function call(method, url, data) {
  try {
    const res = await axios({ method, url, data });
    if (res.data.success) return res.data;
    return { success: false, error: res.data.error };
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

// supplierId null -> the all-suppliers summary; otherwise that supplier's statement.
export function useSupplierLedger(supplierId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const url = supplierId ? `${BASE}/suppliers/${supplierId}/statement` : `${BASE}/summary`;
    const res = await call('get', url);
    if (res.success) setData(res.data);
    else setError(res.error || 'Failed to load supplier ledger');
    setLoading(false);
  }, [supplierId]);

  useEffect(() => {
    setData(null);
    fetchData();
  }, [fetchData]);

  // every mutation refreshes the current view on success
  const mutate = (method, url) => async (body) => {
    const res = await call(method, url, body);
    if (res.success) await fetchData();
    return res;
  };

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    addSupplier: mutate('post', `${BASE}/suppliers`),
    updateSupplier: (id, body) => mutate('put', `${BASE}/suppliers/${id}`)(body),
    deleteSupplier: (id) => mutate('delete', `${BASE}/suppliers/${id}`)(),
    addInvoices: mutate('post', `${BASE}/invoices`),
    updateInvoice: (id, body) => mutate('put', `${BASE}/invoices/${id}`)(body),
    deleteInvoice: (id) => mutate('delete', `${BASE}/invoices/${id}`)(),
    addPayment: mutate('post', `${BASE}/payments`),
    deletePayment: (id) => mutate('delete', `${BASE}/payments/${id}`)(),
  };
}

// Statement import: AI reads the uploaded PDF/photos (nothing saved), the page
// reviews the rows, then importStatement() writes them.
export async function extractStatement(files) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  try {
    const res = await axios.post(`${BASE}/extract`, form);
    return res.data;
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

export const getSupplierReferences = (supplierId) => call('get', `${BASE}/suppliers/${supplierId}/references`);
export const importStatement = (body) => call('post', `${BASE}/import`, body);

export default useSupplierLedger;

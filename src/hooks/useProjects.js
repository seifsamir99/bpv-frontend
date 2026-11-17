import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/projectsApi';

const STORE_KEY = 'projects.selected';

// /projects state: the project list, the selected project's full overview
// (summary + invoices + receipts + costs), and the actions that change it.
// Every action re-reads the overview afterwards so the balance sheet never
// shows a figure the server didn't compute.
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    try { return Number(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
  });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
      setSelectedId((cur) => (list.some((p) => p.id === cur) ? cur : list[0]?.id || null));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const reload = useCallback(async (id = selectedId) => {
    if (!id) { setOverview(null); setLoading(false); return; }
    setLoading(true);
    try {
      setOverview(await api.getOverview(id));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (selectedId) {
      try { localStorage.setItem(STORE_KEY, String(selectedId)); } catch { /* private mode */ }
    }
    reload(selectedId);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap a mutating call: run it, then refresh. Errors are re-thrown so the
  // caller's form can show them next to the button that caused them.
  const act = useCallback(async (fn) => {
    const result = await fn();
    await reload();
    return result;
  }, [reload]);

  return {
    projects, selectedId, setSelectedId, overview, loading, error, reload,
    createProject: async (data) => {
      const p = await api.createProject(data);
      await loadProjects();
      setSelectedId(p.id);
      return p;
    },
    updateProject: async (data) => {
      const p = await api.updateProject(selectedId, data);
      await loadProjects();
      await reload();
      return p;
    },
    previewInvoice: (payload) => api.previewInvoice(selectedId, payload),
    saveInvoice: (payload) => act(() => api.saveInvoice(selectedId, payload)),
    deleteInvoice: (invoiceId) => act(() => api.deleteInvoice(invoiceId)),
    addReceipt: (payload) => act(() => api.addReceipt(selectedId, payload)),
    deleteReceipt: (receiptId) => act(() => api.deleteReceipt(receiptId)),
    decide: (items) => act(() => api.decideCosts(selectedId, items)),
    downloadInvoicePdf: (invoice) => api.downloadInvoicePdf(invoice, overview?.project?.code || ''),
    downloadStatementPdf: () => api.downloadStatementPdf(selectedId, overview?.project?.code || ''),
  };
}

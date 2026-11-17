import axios from 'axios';
import { API_BASE } from './apiBase';

// Client projects (/projects): a site's balance sheet.
// Thin wrapper only. Every money figure and every cost suggestion comes from
// the server (project_service.py); nothing here does arithmetic.
const API = `${API_BASE}/projects`;

const errOf = (err, fallback) =>
  err?.response?.data?.error || err?.message || fallback;

const call = async (fn, fallback) => {
  try {
    const res = await fn();
    if (!res.data.success) throw new Error(res.data.error || fallback);
    return res.data;
  } catch (err) {
    throw new Error(errOf(err, fallback));
  }
};

export const listProjects = async () =>
  (await call(() => axios.get(API), 'Failed to load projects')).projects;

export const createProject = async (project) =>
  (await call(() => axios.post(API, project), 'Failed to create project')).project;

export const updateProject = async (id, project) =>
  (await call(() => axios.put(`${API}/${id}`, project), 'Failed to update project')).project;

export const getOverview = async (id) =>
  call(() => axios.get(`${API}/${id}/overview`), 'Failed to load project');

export const previewInvoice = async (id, payload) =>
  (await call(() => axios.post(`${API}/${id}/invoices/preview`, payload), 'Failed to preview invoice')).preview;

export const saveInvoice = async (id, payload) =>
  (await call(() => axios.post(`${API}/${id}/invoices`, payload), 'Failed to save invoice')).invoice;

export const deleteInvoice = async (invoiceId) =>
  call(() => axios.delete(`${API}/invoices/${invoiceId}`), 'Failed to delete invoice');

export const addReceipt = async (id, payload) =>
  (await call(() => axios.post(`${API}/${id}/receipts`, payload), 'Failed to record payment')).receipt;

export const deleteReceipt = async (receiptId) =>
  call(() => axios.delete(`${API}/receipts/${receiptId}`), 'Failed to delete payment');

// items: [{source, key, status}] - status '' sends a line back to review
export const decideCosts = async (id, items) =>
  call(() => axios.post(`${API}/${id}/costs/decide`, { items }), 'Failed to save decision');

const download = async (url, filename) => {
  try {
    const res = await axios.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  } catch (err) {
    // A JSON error arrives as a Blob when responseType is blob.
    let msg = err?.message || 'Download failed';
    try { msg = JSON.parse(await err.response.data.text()).error || msg; } catch { /* keep msg */ }
    throw new Error(msg);
  }
};

export const downloadInvoicePdf = (invoice, code) =>
  download(`${API}/invoices/${invoice.id}/pdf`, `Tax Invoice ${invoice.invoice_no} - ${code}.pdf`);

export const downloadStatementPdf = (id, code) =>
  download(`${API}/${id}/statement/pdf`, `Statement of Account - ${code}.pdf`);

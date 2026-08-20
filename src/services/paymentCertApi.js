import axios from 'axios';
import { API_BASE } from './apiBase';

// Sub-contractor payment certificates (/payment-cert).
// Thin wrapper only — every money figure comes from the server (see
// payment_cert_service.compute). Nothing here does arithmetic.
const API = `${API_BASE}/payment-cert`;

// The backend answers {success:false, error} with a 400 for refusals the user
// needs to read (over-certification, deleting a non-latest certificate), so the
// message is unwrapped from both the body and the axios error.
const errOf = (err, fallback) =>
  err?.response?.data?.error || err?.message || fallback;

export const listContracts = async ({ archived = false } = {}) => {
  const res = await axios.get(`${API}/contracts`, { params: archived ? { archived: 1 } : {} });
  if (!res.data.success) throw new Error(res.data.error || 'Failed to load contracts');
  return res.data.contracts;
};

export const createContract = async (contract) => {
  try {
    const res = await axios.post(`${API}/contracts`, contract);
    if (!res.data.success) throw new Error(res.data.error);
    return res.data.contract;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to create contract'));
  }
};

export const updateContract = async (id, contract) => {
  try {
    const res = await axios.put(`${API}/contracts/${id}`, contract);
    if (!res.data.success) throw new Error(res.data.error);
    return res.data.contract;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to update contract'));
  }
};

export const archiveContract = async (id) => {
  try {
    const res = await axios.delete(`${API}/contracts/${id}`);
    if (!res.data.success) throw new Error(res.data.error);
    return true;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to archive contract'));
  }
};

export const listCertificates = async (contractId) => {
  const res = await axios.get(`${API}/contracts/${contractId}/certificates`);
  if (!res.data.success) throw new Error(res.data.error || 'Failed to load certificates');
  return { certificates: res.data.certificates, state: res.data.state };
};

export const preview = async (payload) => {
  try {
    const res = await axios.post(`${API}/preview`, payload);
    if (!res.data.success) throw new Error(res.data.error);
    return res.data.preview;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to calculate'));
  }
};

export const saveCertificate = async (payload) => {
  try {
    const res = await axios.post(`${API}/certificates`, payload);
    if (!res.data.success) throw new Error(res.data.error);
    return res.data.certificate;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to save certificate'));
  }
};

export const deleteCertificate = async (id) => {
  try {
    const res = await axios.delete(`${API}/certificates/${id}`);
    if (!res.data.success) throw new Error(res.data.error);
    return true;
  } catch (err) {
    throw new Error(errOf(err, 'Failed to delete certificate'));
  }
};

// Streams the PDF as a blob so the download keeps the server's filename
// (PC-NEMW-S108-2026-00001.pdf) rather than the route.
export const downloadCertificatePdf = async (cert) => {
  const res = await axios.get(`${API}/certificates/${cert.id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(cert.ref_number || 'PaymentCertificate').replace(/[/ ]/g, '')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

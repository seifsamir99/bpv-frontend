import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/paymentCertApi';

// Sub-contractor payment certificates. Holds the contract list, the selected
// contract's certificate history, and the live preview of the certificate
// being entered.
//
// The preview deliberately round-trips to the server on every keystroke
// (debounced): payment_cert_service.compute is the single source of truth for
// the money, and a second implementation in JS is exactly how the printed
// figure and the stored figure drift apart.
export function usePaymentCerts() {
  const [contracts, setContracts] = useState([]);
  const [contractId, setContractId] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [calc, setCalc] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const contract = contracts.find((c) => c.id === contractId) || null;

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await api.listContracts();
      setContracts(rows);
      // Keep the current selection if it survived the reload, else fall to the
      // first contract so the page is never in a blank state with data behind it.
      setContractId((prev) => (rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCertificates = useCallback(async (id) => {
    if (!id) {
      setCertificates([]);
      setState(null);
      return;
    }
    try {
      const { certificates: rows, state: st } = await api.listCertificates(id);
      setCertificates(rows);
      setState(st);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { loadCertificates(contractId); }, [contractId, loadCertificates]);

  // ── live preview ──────────────────────────────────────────────────────
  // Debounced so typing "52500" is one request, not five. The seq guard drops
  // a slow earlier response that lands after a newer one — otherwise the block
  // can settle on the figures for a half-typed amount.
  const seq = useRef(0);
  const timer = useRef(null);

  const runPreview = useCallback((netPaid, otherDeduction) => {
    clearTimeout(timer.current);
    const amount = parseFloat(netPaid);
    if (!contractId || !amount || amount <= 0) {
      setCalc(null);
      setCalcError(null);
      setCalculating(false);
      return;
    }
    setCalculating(true);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const result = await api.preview({
          contract_id: contractId,
          net_paid: amount,
          other_deduction: parseFloat(otherDeduction) || 0,
        });
        if (mine !== seq.current) return;
        setCalc(result);
        setCalcError(null);
      } catch (err) {
        if (mine !== seq.current) return;
        setCalc(null);
        setCalcError(err.message);
      } finally {
        if (mine === seq.current) setCalculating(false);
      }
    }, 350);
  }, [contractId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // ── mutations ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await loadContracts();
    await loadCertificates(contractId);
  }, [loadContracts, loadCertificates, contractId]);

  const save = async (payload) => {
    const cert = await api.saveCertificate({ ...payload, contract_id: contractId });
    await loadCertificates(contractId);
    setCalc(null);
    return cert;
  };

  const remove = async (id) => {
    await api.deleteCertificate(id);
    await loadCertificates(contractId);
  };

  const addContract = async (data) => {
    const created = await api.createContract(data);
    await loadContracts();
    setContractId(created.id);
    return created;
  };

  const editContract = async (id, data) => {
    const updated = await api.updateContract(id, data);
    await loadContracts();
    return updated;
  };

  const archive = async (id) => {
    await api.archiveContract(id);
    await loadContracts();
  };

  return {
    contracts, contract, contractId, setContractId,
    certificates, state, loading, error, setError,
    calc, calcError, calculating, runPreview,
    save, remove, addContract, editContract, archive, refresh,
    downloadPdf: api.downloadCertificatePdf,
  };
}

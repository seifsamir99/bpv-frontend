import React, { useState, useEffect } from 'react';
import {
  HiDocumentText, HiDownload, HiTrash, HiPlus, HiX, HiPencil,
  HiExclamation, HiRefresh,
} from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import { usePaymentCerts } from '../hooks/usePaymentCerts';

const today = () => new Date().toISOString().split('T')[0];

const money = (v) =>
  Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Certificates run a month behind, same as payroll: in August you are
// certifying July's work.
const defaultBillMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.toLocaleString('en-US', { month: 'short' })}-${String(d.getFullYear()).slice(2)}`;
};

const EMPTY_CONTRACT = {
  subcontractor: '', project: '', project_code: '', scope: '', job_order_ref: '',
  contract_value: '', retention_percent: 10, vat_percent: 5,
  contact: '', phone: '', address: '', scope_items: [],
};

export default function PaymentCertPage() {
  const pc = usePaymentCerts();
  const {
    contracts, contract, contractId, setContractId,
    certificates, state, loading, error, setError,
    calc, calcError, calculating, runPreview,
  } = pc;

  // ── the month's certificate ─────────────────────────────────────────
  const [form, setForm] = useState({
    net_paid: '', invoice_date: today(), bill_month: defaultBillMonth(),
    bill_type: 'interim', other_deduction: '', other_deduction_note: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    runPreview(form.net_paid, form.other_deduction);
  }, [form.net_paid, form.other_deduction, runPreview]);

  // Switching contract must not carry the previous one's amount across.
  useEffect(() => {
    setForm((f) => ({ ...f, net_paid: '', other_deduction: '', other_deduction_note: '' }));
    setSaveError(null);
    setNotice(null);
  }, [contractId]);

  const handleSave = async (allowOverrun = false) => {
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const cert = await pc.save({
        net_paid: parseFloat(form.net_paid),
        invoice_date: form.invoice_date,
        bill_month: form.bill_month,
        bill_type: form.bill_type,
        other_deduction: parseFloat(form.other_deduction) || 0,
        other_deduction_note: form.other_deduction_note,
        allow_overrun: allowOverrun,
      });
      setForm((f) => ({ ...f, net_paid: '', other_deduction: '', other_deduction_note: '' }));
      setNotice(`Saved as Bill No. ${cert.cert_no} — ${cert.ref_number}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cert) => {
    if (!window.confirm(
      `Delete Bill No. ${cert.cert_no} (${cert.ref_number})?\n\n` +
      `Net certified AED ${money(cert.net_payable)}. This cannot be undone.`)) return;
    try {
      await pc.remove(cert.id);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── contract editor ─────────────────────────────────────────────────
  const [editing, setEditing] = useState(null);   // null | 'new' | contract id
  const [draft, setDraft] = useState(EMPTY_CONTRACT);
  const [contractError, setContractError] = useState(null);
  const [savingContract, setSavingContract] = useState(false);

  const openNew = () => {
    setDraft(EMPTY_CONTRACT);
    setContractError(null);
    setEditing('new');
  };

  const openEdit = () => {
    if (!contract) return;
    setDraft({ ...contract, scope_items: contract.scope_items || [] });
    setContractError(null);
    setEditing(contract.id);
  };

  const saveContract = async () => {
    setSavingContract(true);
    setContractError(null);
    try {
      const payload = {
        ...draft,
        contract_value: parseFloat(draft.contract_value) || 0,
        retention_percent: parseFloat(draft.retention_percent) || 0,
        vat_percent: parseFloat(draft.vat_percent) || 0,
        scope_items: (draft.scope_items || []).filter((s) => String(s).trim()),
      };
      if (editing === 'new') await pc.addContract(payload);
      else await pc.editContract(editing, payload);
      setEditing(null);
    } catch (err) {
      setContractError(err.message);
    } finally {
      setSavingContract(false);
    }
  };

  const setScopeItem = (i, value) =>
    setDraft((d) => {
      const items = [...(d.scope_items || [])];
      items[i] = value;
      return { ...d, scope_items: items };
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Payment Certificates"
        subtitle="Certify subcontractor monthly payments"
        icon={HiDocumentText}
        onAction={openNew}
        actionLabel="New Contract"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)}><HiX className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <HiDocumentText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No subcontracts yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">
              Add the subcontract once, then each month you only enter the amount.
            </p>
            <button onClick={openNew} className="btn-gradient-blue inline-flex items-center gap-2">
              <HiPlus className="w-5 h-5" /> New Contract
            </button>
          </div>
        ) : (
          <>
            {/* ── contract picker + position ───────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                <div className="flex-1">
                  <label className="input-label">Subcontract</label>
                  <select
                    className="input-field"
                    value={contractId ?? ''}
                    onChange={(e) => setContractId(Number(e.target.value))}
                  >
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.subcontractor}{c.project ? ` — ${c.project}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={openEdit} className="btn-gradient-purple flex items-center gap-2">
                    <HiPencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={pc.refresh}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    title="Refresh"
                  >
                    <HiRefresh className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {contract && state && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                  {[
                    ['Contract Value', state.contract_value, 'text-slate-800'],
                    ['Certified to Date', state.previously_certified, 'text-blue-600'],
                    ['Balance', state.balance_of_contract, 'text-slate-800'],
                    ['Retention Held', state.retention_held, 'text-amber-600'],
                    ['Paid to Date', state.previously_paid, 'text-emerald-600'],
                  ].map(([label, value, tone]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${tone}`}>{money(value)}</p>
                    </div>
                  ))}
                </div>
              )}

              {contract && (
                <p className="text-xs text-slate-400 mt-3">
                  {contract.scope && <>Scope: {contract.scope} · </>}
                  Retention {contract.retention_percent}% · VAT {contract.vat_percent}%
                  {contract.job_order_ref && <> · {contract.job_order_ref}</>}
                </p>
              )}
            </div>

            {/* ── this month's certificate ─────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-4">
                  New Certificate
                  {state && <span className="text-slate-400 font-normal"> — Bill No. {state.last_cert_no + 1}</span>}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Bill Month</label>
                    <input
                      className="input-field"
                      value={form.bill_month}
                      onChange={(e) => set('bill_month', e.target.value)}
                      placeholder="Jul-26"
                    />
                  </div>
                  <div>
                    <label className="input-label">Invoice Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={form.invoice_date}
                      onChange={(e) => set('invoice_date', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="input-label">Net amount to pay this month</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field text-lg font-semibold"
                    value={form.net_paid}
                    onChange={(e) => set('net_paid', e.target.value)}
                    placeholder="15000.00"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    The cash the subcontractor actually receives. Certified value, retention
                    and VAT are worked back from this figure.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="input-label">Other Deduction (optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={form.other_deduction}
                      onChange={(e) => set('other_deduction', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="input-label">Reason</label>
                    <input
                      className="input-field"
                      value={form.other_deduction_note}
                      onChange={(e) => set('other_deduction_note', e.target.value)}
                      placeholder="Safety violation"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="input-label">Bill Type</label>
                  <div className="flex gap-4 mt-1">
                    {['interim', 'final'].map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="radio"
                          checked={form.bill_type === t}
                          onChange={() => set('bill_type', t)}
                        />
                        <span className="capitalize">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── live certification block ───────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-800 mb-4">
                  Certification {calculating && <span className="text-slate-400 font-normal">— calculating…</span>}
                </h2>

                {calcError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">
                    {calcError}
                  </div>
                )}

                {!calc ? (
                  <div className="text-center py-12 text-slate-300 text-sm">
                    Enter this month's amount to see the certificate
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 text-sm">
                      <Row label="Amount Certified (excl. VAT)" value={calc.amount_ex_vat} />
                      <Row
                        label={`Less Retention (${contract?.retention_percent}%)`}
                        value={-calc.retention_amount}
                        negative
                      />
                      {calc.other_deduction > 0 && (
                        <Row label="Less Other Deduction" value={-calc.other_deduction} negative />
                      )}
                      <div className="border-t border-slate-200 pt-1.5">
                        <Row label="Total Amount" value={calc.total_amount} bold />
                      </div>
                      <Row label={`Value Added Tax (${contract?.vat_percent}%)`} value={calc.vat_charged} />
                      <div className="border-t-2 border-slate-300 pt-2 mt-1">
                        <Row label="NET CERTIFIED THIS PAYMENT" value={calc.net_payable} bold big />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Cumulative certified after this</span>
                        <span className="font-medium">{money(calc.cumulative_certified)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Balance of contract after this</span>
                        <span className="font-medium">{money(calc.balance_after)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retention held after this</span>
                        <span className="font-medium">{money(calc.retention_held_after)}</span>
                      </div>
                    </div>

                    {calc.retention_amount > 0 && (
                      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                        VAT is charged after retention. VAT on the full certified value is
                        {' '}{money(calc.vat_portion)}; the {money(calc.vat_portion - calc.vat_charged)} difference
                        falls due when the retention is released.
                      </p>
                    )}

                    {calc.over_certified && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
                        <HiExclamation className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-800">
                          This exceeds the contract value by <strong>{money(calc.overrun_amount)}</strong>.
                          Raise the contract value if this is a variation order.
                        </p>
                      </div>
                    )}

                    {saveError && (
                      <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                        {saveError}
                      </div>
                    )}
                    {notice && (
                      <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 text-sm">
                        {notice}
                      </div>
                    )}

                    <button
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="btn-gradient-blue w-full mt-4 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Certificate'}
                    </button>
                    {calc.over_certified && (
                      <button
                        onClick={() => handleSave(true)}
                        disabled={saving}
                        className="w-full mt-2 text-xs text-amber-700 underline disabled:opacity-50"
                      >
                        Certify anyway (over contract value)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── history ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">
                  Issued Certificates <span className="text-slate-400 font-normal">({certificates.length})</span>
                </h2>
              </div>

              {certificates.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">
                  No certificates issued on this contract yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        {['Bill', 'Reference', 'Month', 'Date', 'Certified', 'Retention', 'VAT', 'Net Paid', ''].map((h, i) => (
                          <th key={h + i} className={`px-3 py-2 font-medium ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {certificates.map((c, i) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {c.cert_no}
                            {c.bill_type === 'final' && (
                              <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                FINAL
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">{c.ref_number}</td>
                          <td className="px-3 py-2 text-slate-600">{c.bill_month}</td>
                          <td className="px-3 py-2 text-slate-600">{c.invoice_date}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{money(c.amount_ex_vat)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">({money(c.retention_amount)})</td>
                          <td className="px-3 py-2 text-right text-slate-600">{money(c.vat_charged)}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600">{money(c.net_payable)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => pc.downloadPdf(c)}
                                className="p-1.5 rounded text-blue-500 hover:bg-blue-50"
                                title="Download PDF"
                              >
                                <HiDownload className="w-4 h-4" />
                              </button>
                              {/* Only the latest may be removed — deleting from the
                                  middle would change every later cumulative figure. */}
                              {i === certificates.length - 1 && (
                                <button
                                  onClick={() => handleDelete(c)}
                                  className="p-1.5 rounded text-red-400 hover:bg-red-50"
                                  title="Delete (latest only)"
                                >
                                  <HiTrash className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── contract editor modal ─────────────────────────────────── */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                {editing === 'new' ? 'New Subcontract' : 'Edit Subcontract'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <HiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {contractError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {contractError}
                </div>
              )}

              <div>
                <label className="input-label">Subcontractor *</label>
                <input
                  className="input-field"
                  value={draft.subcontractor}
                  onChange={(e) => setDraft({ ...draft, subcontractor: e.target.value })}
                  placeholder="AL SHOLA AL MODEA GAS DISTRIBUTION LLC"
                />
              </div>

              <div>
                <label className="input-label">Project</label>
                <input
                  className="input-field"
                  value={draft.project}
                  onChange={(e) => setDraft({ ...draft, project: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Project Code</label>
                  <input
                    className="input-field"
                    value={draft.project_code}
                    onChange={(e) => setDraft({ ...draft, project_code: e.target.value })}
                    placeholder="S 108"
                  />
                </div>
                <div>
                  <label className="input-label">Scope</label>
                  <input
                    className="input-field"
                    value={draft.scope}
                    onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                    placeholder="GAS SYSTEM"
                  />
                </div>
                <div>
                  <label className="input-label">Job Order Ref</label>
                  <input
                    className="input-field"
                    value={draft.job_order_ref}
                    onChange={(e) => setDraft({ ...draft, job_order_ref: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Contract Value (excl. VAT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={draft.contract_value}
                    onChange={(e) => setDraft({ ...draft, contract_value: e.target.value })}
                    placeholder="200000.00"
                  />
                </div>
                <div>
                  <label className="input-label">Retention %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={draft.retention_percent}
                    onChange={(e) => setDraft({ ...draft, retention_percent: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">VAT %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={draft.vat_percent}
                    onChange={(e) => setDraft({ ...draft, vat_percent: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 -mt-2">
                Contract value is the amount <strong>before</strong> VAT. A job order quoting a
                "grand total with VAT" must be divided by {1 + (parseFloat(draft.vat_percent) || 0) / 100} first.
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Contact</label>
                  <input
                    className="input-field"
                    value={draft.contact}
                    onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input
                    className="input-field"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Address</label>
                  <input
                    className="input-field"
                    value={draft.address}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Scope Items (printed on the certificate)</label>
                <div className="space-y-2 mt-1">
                  {(draft.scope_items || []).map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input-field flex-1"
                        value={item}
                        onChange={(e) => setScopeItem(i, e.target.value)}
                      />
                      <button
                        onClick={() => setDraft({
                          ...draft,
                          scope_items: draft.scope_items.filter((_, j) => j !== i),
                        })}
                        className="p-2 text-red-400 hover:bg-red-50 rounded"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraft({ ...draft, scope_items: [...(draft.scope_items || []), ''] })}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <HiPlus className="w-4 h-4" /> Add item
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveContract}
                disabled={savingContract}
                className="btn-gradient-blue disabled:opacity-50"
              >
                {savingContract ? 'Saving…' : 'Save Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, big, negative }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={`${bold ? 'font-semibold text-slate-800' : 'text-slate-600'} ${big ? 'text-sm' : ''}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${big ? 'text-lg' : ''} ${
          bold ? 'font-bold' : ''
        } ${negative ? 'text-amber-600' : 'text-slate-800'}`}
      >
        {negative ? `(${money(Math.abs(value))})` : money(value)}
      </span>
    </div>
  );
}

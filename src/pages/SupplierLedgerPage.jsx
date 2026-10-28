import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  HiScale, HiPlus, HiTrash, HiPencil, HiCheck, HiX, HiPrinter, HiArrowLeft,
  HiCash, HiExclamation, HiClock, HiOfficeBuilding, HiSearch, HiLightningBolt, HiUpload,
} from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import {
  useSupplierLedger, extractStatement, getSupplierReferences, importStatement,
} from '../hooks/useSupplierLedger';

// Supplier ledger (accounts payable): what Newell owes each supplier, invoice
// by invoice, with payments allocated against invoices and ageing laid out like
// the suppliers' own "Statement of Account (Outstanding)". All balances come
// derived from the backend; dates travel as ISO YYYY-MM-DD.

const BUCKETS = [
  ['d0_30', '0-30'], ['d31_60', '31-60'], ['d61_90', '61-90'],
  ['d91_120', '91-120'], ['d121_plus', 'Above 121'],
];
const METHODS = ['Cheque', 'PDC', 'Bank Transfer', 'Cash'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
const formatAED = (amount) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
const fmtDate = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inputCls = 'input-field py-1.5 text-sm';

function Kpi({ label, value, tone = 'text-slate-800', sub, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1.5">
        {Icon && <Icon className="w-4 h-4" />} {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AgeingStrip({ ageing }) {
  const total = BUCKETS.reduce((a, [k]) => a + (ageing?.[k] || 0), 0);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-slate-100">
        {BUCKETS.map(([k, label]) => (
          <div key={k} className="p-3 text-center">
            <div className="text-xs font-semibold text-slate-500 uppercase">{label} days</div>
            <div className={`text-sm font-bold mt-1 ${ageing?.[k] > 0 ? (k === 'd0_30' ? 'text-slate-800' : 'text-red-600') : 'text-slate-300'}`}>
              {formatAED(ageing?.[k])}
            </div>
          </div>
        ))}
        <div className="p-3 text-center bg-slate-50">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total</div>
          <div className="text-sm font-bold mt-1 text-slate-900">{formatAED(total)}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supplier form (add / edit)
// ---------------------------------------------------------------------------
const emptySupplier = { name: '', code: '', paymentTermsDays: '0', phone: '', trn: '', notes: '' };

function SupplierForm({ initial, onSave, onCancel, saveLabel }) {
  const [s, setS] = useState(initial || emptySupplier);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    if (!s.name.trim()) { alert('Supplier name is required.'); return; }
    setSaving(true);
    const res = await onSave({ ...s, paymentTermsDays: parseInt(s.paymentTermsDays || 0, 10) });
    setSaving(false);
    if (!res.success) alert(res.error || 'Failed to save supplier');
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <div className="md:col-span-2">
        <label className="input-label">Supplier Name</label>
        <input className={inputCls} value={s.name} onChange={set('name')} placeholder="e.g. Touch Home Building Materials" />
      </div>
      <div>
        <label className="input-label">Our Account Code</label>
        <input className={inputCls} value={s.code} onChange={set('code')} placeholder="CUST0149" />
      </div>
      <div>
        <label className="input-label">Credit Terms (days)</label>
        <input type="number" min="0" className={inputCls} value={s.paymentTermsDays} onChange={set('paymentTermsDays')} />
      </div>
      <div>
        <label className="input-label">Phone</label>
        <input className={inputCls} value={s.phone} onChange={set('phone')} />
      </div>
      <div>
        <label className="input-label">TRN</label>
        <input className={inputCls} value={s.trn} onChange={set('trn')} />
      </div>
      <div className="md:col-span-4">
        <label className="input-label">Notes</label>
        <input className={inputCls} value={s.notes} onChange={set('notes')} />
      </div>
      <div className="md:col-span-2 flex items-end justify-end gap-2">
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
        )}
        <button onClick={submit} disabled={saving} className="btn-gradient-blue flex items-center gap-2 disabled:opacity-60">
          <HiCheck className="w-5 h-5" /> {saving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import statement: upload PDF/photos -> AI reads rows -> review -> import
// ---------------------------------------------------------------------------
const blankNewSupplier = (x = {}) => ({
  name: x.supplierName || '', code: x.ourAccountCode || '', phone: x.supplierPhone || '',
  trn: x.supplierTrn || '', notes: x.supplierAddress || '', paymentTermsDays: '0',
});

function ImportPanel({ suppliers, presetSupplierId, onClose, onDone }) {
  const [stage, setStage] = useState('pick'); // pick | reading | review
  const [files, setFiles] = useState([]);
  const [ext, setExt] = useState(null);
  const [rows, setRows] = useState([]);
  const [payRows, setPayRows] = useState([]);
  const [target, setTarget] = useState(presetSupplierId ? String(presetSupplierId) : 'new');
  const [newSup, setNewSup] = useState(blankNewSupplier());
  const [existing, setExisting] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const read = async () => {
    if (!files.length) { setErr('Choose the statement PDF or photos first.'); return; }
    setErr(null);
    setStage('reading');
    const res = await extractStatement(files);
    if (!res.success) { setErr(res.error || 'Could not read the statement'); setStage('pick'); return; }
    const d = res.data;
    setExt(d);
    setRows(d.invoices.map((r, idx) => ({ ...r, key: idx, include: r.balance > 0 || r.amount > 0 })));
    setPayRows(d.unallocatedPayments.map((p, idx) => ({ ...p, key: idx, include: true })));
    setNewSup(blankNewSupplier(d));
    if (!presetSupplierId) setTarget(d.matchedSupplier ? String(d.matchedSupplier.id) : 'new');
    setStage('review');
  };

  // references already in the ledger for the chosen supplier
  useEffect(() => {
    if (stage !== 'review' || target === 'new') { setExisting([]); return; }
    let cancelled = false;
    getSupplierReferences(target).then((res) => { if (!cancelled && res.success) setExisting(res.data); });
    return () => { cancelled = true; };
  }, [stage, target]);

  const existingRefs = useMemo(() => new Set(existing.map((e) => e.reference.trim())), [existing]);
  useEffect(() => {
    setRows((rs) => rs.map((r) => (existingRefs.has(String(r.reference).trim()) ? { ...r, include: false } : r)));
  }, [existingRefs]);

  const statementRefs = useMemo(() => new Set(rows.map((r) => String(r.reference).trim())), [rows]);
  const missing = existing.filter((e) => e.balance > 0 && !statementRefs.has(e.reference.trim()));

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const rowsBalance = round2(rows.reduce((a, r) => a + num(r.amount) - num(r.cleared), 0));
  const paysTotal = round2(payRows.reduce((a, p) => a + num(p.amount), 0));
  const computed = round2(rowsBalance - paysTotal);
  const reconciles = ext?.hasStatedTotal && Math.abs(computed - ext.statedTotalOutstanding) < 0.01;
  const included = rows.filter((r) => r.include);
  const importTotal = round2(included.reduce((a, r) => a + num(r.amount) - num(r.cleared), 0)
    - payRows.filter((p) => p.include).reduce((a, p) => a + num(p.amount), 0));

  const doImport = async () => {
    if (target === 'new' && !newSup.name.trim()) { alert('Enter the supplier name.'); return; }
    if (!included.length && !payRows.some((p) => p.include)) { alert('Nothing selected to import.'); return; }
    if (ext.hasStatedTotal && !reconciles && !window.confirm(
      `The rows don't add up to the statement's total (difference AED ${formatAED(computed - ext.statedTotalOutstanding)}). ` +
      'Check the highlighted figures. Import anyway?')) return;
    setSaving(true);
    const res = await importStatement({
      ...(target === 'new'
        ? { newSupplier: { ...newSup, paymentTermsDays: parseInt(newSup.paymentTermsDays || 0, 10) } }
        : { supplierId: Number(target) }),
      statementDate: ext.statementDate || '',
      invoices: included.map((r) => ({
        invoiceDate: r.invoiceDate, dueDate: r.dueDate, reference: String(r.reference).trim(),
        description: r.description, amount: num(r.amount), cleared: num(r.cleared),
      })),
      unallocatedPayments: payRows.filter((p) => p.include).map((p) => ({ date: p.date, reference: p.reference, amount: num(p.amount) })),
    });
    setSaving(false);
    if (!res.success) { alert(res.error || 'Import failed'); return; }
    const d = res.data;
    alert(`Imported ${d.added} invoice(s)` +
      (d.clearedPayments ? `, ${d.clearedPayments} part-payment(s)` : '') +
      (d.paymentsAdded ? `, ${d.paymentsAdded} receipt(s) on account` : '') +
      (d.skipped.length ? `. Skipped ${d.skipped.length} already in the ledger.` : '.'));
    onDone(d.supplierId);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HiUpload className="w-4 h-4 text-blue-600" /> Import Supplier Statement
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><HiX className="w-4 h-4" /></button>
      </div>

      {stage !== 'review' && (
        <div>
          <p className="text-sm text-slate-500 mb-3">
            Upload the supplier's Statement of Account: one PDF, or photos of every page. AI reads every invoice,
            then you check the rows before anything is saved.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={stage === 'reading'}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100" />
            <button onClick={read} disabled={stage === 'reading' || !files.length}
              className="btn-gradient-blue flex items-center gap-2 disabled:opacity-60">
              <HiLightningBolt className="w-5 h-5" /> {stage === 'reading' ? 'Reading statement...' : 'Read Statement'}
            </button>
          </div>
          {stage === 'reading' && (
            <p className="text-xs text-slate-400 mt-3">This usually takes 30 seconds to 2 minutes for a long statement.</p>
          )}
          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        </div>
      )}

      {stage === 'review' && ext && (
        <div>
          {/* supplier */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
            <div className="md:col-span-2">
              <label className="input-label">Supplier</label>
              <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">+ New supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="text-xs text-slate-400 mt-1">
                Statement says: <span className="text-slate-600">{ext.supplierName || '?'}</span>
                {ext.statementDate && <> · dated {fmtDate(ext.statementDate)}</>}
              </div>
            </div>
            {target === 'new' && (
              <>
                <div className="md:col-span-2">
                  <label className="input-label">New Supplier Name</label>
                  <input className={inputCls} value={newSup.name} onChange={(e) => setNewSup((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Our Account Code</label>
                  <input className={inputCls} value={newSup.code} onChange={(e) => setNewSup((s) => ({ ...s, code: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Credit Terms (days)</label>
                  <input type="number" min="0" className={inputCls} value={newSup.paymentTermsDays}
                    onChange={(e) => setNewSup((s) => ({ ...s, paymentTermsDays: e.target.value }))} />
                </div>
              </>
            )}
          </div>

          {/* reconciliation */}
          <div className={`rounded-lg px-3 py-2 text-sm mb-3 ${!ext.hasStatedTotal ? 'bg-slate-50 text-slate-600' : reconciles ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {rows.length} invoice rows read, adding up to <b>AED {formatAED(computed)}</b> outstanding
            {paysTotal > 0 && <> (after {formatAED(paysTotal)} receipts)</>}.{' '}
            {!ext.hasStatedTotal ? 'The statement shows no total to check against.'
              : reconciles ? <>Matches the statement's total of AED {formatAED(ext.statedTotalOutstanding)}. ✓</>
                : <>The statement's total is AED {formatAED(ext.statedTotalOutstanding)}, a difference of {formatAED(computed - ext.statedTotalOutstanding)}. Check the rows against the PDF.</>}
          </div>
          {ext.notes && <div className="rounded-lg px-3 py-2 text-sm mb-3 bg-amber-50 text-amber-800">Note from the reader: {ext.notes}</div>}
          {missing.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-sm mb-3 bg-blue-50 text-blue-800">
              {missing.length} open invoice(s) in the ledger are not on this statement, so the supplier has probably been paid for them:{' '}
              {missing.slice(0, 12).map((m) => m.reference).join(', ')}{missing.length > 12 ? ', ...' : ''}.
              Record those payments on the supplier page.
            </div>
          )}

          {/* rows */}
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox" checked={rows.length > 0 && rows.every((r) => r.include || existingRefs.has(String(r.reference).trim()))}
                      onChange={(e) => setRows((rs) => rs.map((r) => ({ ...r, include: e.target.checked && !existingRefs.has(String(r.reference).trim()) })))} />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold">Inv. Date</th>
                  <th className="px-2 py-2 text-left font-semibold">Reference</th>
                  <th className="px-2 py-2 text-left font-semibold">Description</th>
                  <th className="px-2 py-2 text-left font-semibold">Due</th>
                  <th className="px-2 py-2 text-right font-semibold">Amount</th>
                  <th className="px-2 py-2 text-right font-semibold">Cleared</th>
                  <th className="px-2 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const dup = existingRefs.has(String(r.reference).trim());
                  const off = Math.abs(round2(num(r.amount) - num(r.cleared)) - num(r.balance)) >= 0.01;
                  return (
                    <tr key={r.key} className={dup ? 'bg-slate-50 text-slate-400' : r.include ? '' : 'text-slate-400'}>
                      <td className="px-2 py-1"><input type="checkbox" checked={r.include} disabled={dup}
                        onChange={(e) => setRow(r.key, { include: e.target.checked })} /></td>
                      <td className="px-2 py-1"><input type="date" className={`${inputCls} w-36`} value={r.invoiceDate}
                        onChange={(e) => setRow(r.key, { invoiceDate: e.target.value })} /></td>
                      <td className="px-2 py-1">
                        <input className={`${inputCls} w-28`} value={r.reference} onChange={(e) => setRow(r.key, { reference: e.target.value })} />
                        {dup && <div className="text-xs text-slate-400">already in ledger</div>}
                      </td>
                      <td className="px-2 py-1 text-xs max-w-[12rem] truncate" title={r.description}>{r.description}</td>
                      <td className="px-2 py-1 text-xs whitespace-nowrap">{r.dueDate ? fmtDate(r.dueDate) : '-'}</td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className={`${inputCls} w-28 text-right`} value={r.amount}
                        onChange={(e) => setRow(r.key, { amount: e.target.value })} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className={`${inputCls} w-24 text-right`} value={r.cleared}
                        onChange={(e) => setRow(r.key, { cleared: e.target.value })} /></td>
                      <td className={`px-2 py-1 text-right ${off ? 'text-red-600 font-semibold' : ''}`}
                        title={off ? "Amount minus cleared doesn't equal the balance printed on the statement" : ''}>
                        {formatAED(r.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {payRows.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium text-slate-700 mb-1">Receipts on the statement (added as payments on account)</div>
              {payRows.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={p.include}
                    onChange={(e) => setPayRows((ps) => ps.map((x) => (x.key === p.key ? { ...x, include: e.target.checked } : x)))} />
                  {fmtDate(p.date)} · {p.reference || 'no ref'} · AED {formatAED(p.amount)}
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="text-sm text-slate-600">
              Importing <b>{included.length}</b> invoice(s), adding <b>AED {formatAED(importTotal)}</b> to what you owe.
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStage('pick'); setExt(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                Start over
              </button>
              <button onClick={doImport} disabled={saving} className="btn-gradient-blue flex items-center gap-2 disabled:opacity-60">
                <HiCheck className="w-5 h-5" /> {saving ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary: all suppliers
// ---------------------------------------------------------------------------
function SummaryView({ openSupplier }) {
  const { data, loading, error, addSupplier } = useSupplierLedger(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const t = data?.totals;

  // --- Print / Save as PDF: every supplier with a balance and its net payable ---
  const handlePrintList = () => {
    const list = data.suppliers.filter((s) => round2(s.outstanding) !== 0);
    const rows = list.map((s, idx) => `<tr>
      <td>${idx + 1}</td><td class="l">${esc(s.name)}</td><td class="l">${esc(s.code)}</td>
      <td class="b">${formatAED(s.outstanding)}</td></tr>`).join('');
    const total = list.reduce((a, s) => a + s.outstanding, 0);
    const html = `<!DOCTYPE html><html><head><title>Supplier Payables - ${fmtDate(data.asOf)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0; } h2 { font-size: 13px; text-align: center; text-decoration: underline; margin: 10px 0; }
  .row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
  th { background: #f1f5f9; font-size: 10px; } td.l, th.l { text-align: left; } td.b { font-weight: bold; }
  th:first-child, td:first-child { width: 28px; text-align: center; }
  tr { break-inside: avoid; } thead { display: table-header-group; }
  tfoot td { font-weight: bold; background: #f8fafc; font-size: 12px; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <h2>SUPPLIER PAYABLES SUMMARY</h2>
  <div class="row"><div>As on: <b>${fmtDate(data.asOf)}</b></div></div>
  <table><thead><tr><th>#</th><th class="l">Supplier</th><th class="l">Our A/c Code</th><th>Net Payable (AED)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3" class="l">Total (${list.length} suppliers)</td><td>${formatAED(total)}</td></tr></tfoot></table>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Popup blocked. Allow popups for this site to print the list.'); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Supplier Ledger"
        subtitle={data ? `Payables as on ${fmtDate(data.asOf)}` : 'Payables'}
        icon={HiScale}
        onAction={() => setShowAdd((v) => !v)}
        actionLabel="Add Supplier"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && !data ? (
          <div className="text-center text-slate-400 py-16">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-16">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Kpi icon={HiScale} label="Total Liabilities" value={`AED ${formatAED(t.outstanding)}`}
                sub={`${t.openCount} open invoices`} />
              <Kpi icon={HiExclamation} label="Overdue" value={`AED ${formatAED(t.overdue)}`} tone="text-red-600"
                sub={`${t.overdueCount} invoices past due`} />
              <Kpi icon={HiClock} label="Due in 7 days" value={`AED ${formatAED(t.dueSoon)}`} tone="text-amber-600" />
              <Kpi icon={HiOfficeBuilding} label="Suppliers" value={data.suppliers.length}
                sub={`${data.suppliers.filter((s) => s.outstanding > 0).length} with a balance`} />
            </div>

            <AgeingStrip ageing={t.ageing} />

            {showImport ? (
              <ImportPanel
                suppliers={data.suppliers}
                onClose={() => setShowImport(false)}
                onDone={(sid) => openSupplier(sid)}
              />
            ) : (
              <div className="flex justify-end gap-2 mb-4">
                <button onClick={handlePrintList} disabled={!data.suppliers.length}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2">
                  <HiPrinter className="w-5 h-5" /> Print Suppliers
                </button>
                <button onClick={() => setShowImport(true)} className="btn-gradient-blue flex items-center gap-2">
                  <HiUpload className="w-5 h-5" /> Import Statement (PDF)
                </button>
              </div>
            )}

            {showAdd && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <HiPlus className="w-4 h-4" /> New Supplier
                </h3>
                <SupplierForm
                  saveLabel="Add Supplier"
                  onCancel={() => setShowAdd(false)}
                  onSave={async (s) => {
                    const res = await addSupplier(s);
                    if (res.success) setShowAdd(false);
                    return res;
                  }}
                />
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                      <th className="px-4 py-3 text-right font-semibold">Overdue</th>
                      {BUCKETS.map(([k, label]) => (
                        <th key={k} className="px-3 py-3 text-right font-semibold whitespace-nowrap">{label}</th>
                      ))}
                      <th className="px-4 py-3 text-left font-semibold">Last Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.suppliers.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No suppliers yet. Click "Add Supplier".</td></tr>
                    ) : data.suppliers.map((s) => (
                      <tr key={s.id} onClick={() => openSupplier(s.id)} className="hover:bg-blue-50/50 cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{s.name}</div>
                          <div className="text-xs text-slate-400">
                            {s.openCount} open{s.code ? ` · ${s.code}` : ''}{s.paymentTermsDays ? ` · ${s.paymentTermsDays}-day terms` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatAED(s.outstanding)}</td>
                        <td className={`px-4 py-3 text-right ${s.overdue > 0 ? 'text-red-600 font-semibold' : 'text-slate-300'}`}>{formatAED(s.overdue)}</td>
                        {BUCKETS.map(([k]) => (
                          <td key={k} className={`px-3 py-3 text-right ${s.ageing[k] > 0 ? 'text-slate-700' : 'text-slate-300'}`}>{formatAED(s.ageing[k])}</td>
                        ))}
                        <td className="px-4 py-3 text-slate-500">{fmtDate(s.lastPayment)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data.suppliers.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">{formatAED(t.outstanding)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatAED(t.overdue)}</td>
                        {BUCKETS.map(([k]) => (
                          <td key={k} className="px-3 py-3 text-right">{formatAED(t.ageing[k])}</td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record payment panel
// ---------------------------------------------------------------------------
function PaymentPanel({ supplierId, invoices, onSave, onClose }) {
  const openInvoices = useMemo(
    () => invoices.filter((i) => i.balance > 0)
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id),
    [invoices]);
  const [p, setP] = useState({ paymentDate: todayISO(), amount: '', method: 'Cheque', chequeNo: '', bpvNo: '', notes: '' });
  const [alloc, setAlloc] = useState({}); // invoiceId -> amount string
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));

  const allocated = round2(Object.values(alloc).reduce((a, v) => a + num(v), 0));
  const remainder = round2(num(p.amount) - allocated);

  const autoAllocate = () => {
    let left = num(p.amount);
    const next = {};
    for (const inv of openInvoices) {
      if (left <= 0) break;
      const take = round2(Math.min(left, inv.balance));
      next[inv.id] = String(take);
      left = round2(left - take);
    }
    setAlloc(next);
  };
  const toggle = (inv) => setAlloc((a) => {
    const next = { ...a };
    if (next[inv.id] !== undefined) delete next[inv.id];
    else next[inv.id] = String(inv.balance);
    return next;
  });
  // ticking invoices with no amount typed yet -> amount follows the selection
  useEffect(() => {
    if (p.amount === '' && allocated > 0) setP((x) => ({ ...x, amount: String(allocated) }));
  }, [allocated]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (num(p.amount) <= 0) { alert('Enter the payment amount.'); return; }
    if (remainder < 0) { alert('Allocated more than the payment amount.'); return; }
    if (remainder > 0 && !window.confirm(
      `AED ${formatAED(remainder)} is not allocated to any invoice and will sit "on account". Continue?`)) return;
    setSaving(true);
    const res = await onSave({
      ...p,
      supplierId,
      amount: num(p.amount),
      allocations: Object.entries(alloc).filter(([, v]) => num(v) > 0)
        .map(([invoiceId, v]) => ({ invoiceId: Number(invoiceId), amount: num(v) })),
    });
    setSaving(false);
    if (res.success) onClose();
    else alert(res.error || 'Failed to record payment');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-emerald-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HiCash className="w-4 h-4 text-emerald-600" /> Record Payment
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><HiX className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="input-label">Date</label>
          <input type="date" className={inputCls} value={p.paymentDate} onChange={set('paymentDate')} />
        </div>
        <div>
          <label className="input-label">Amount (AED)</label>
          <input type="number" step="0.01" className={inputCls} value={p.amount} onChange={set('amount')} />
        </div>
        <div>
          <label className="input-label">Method</label>
          <select className={inputCls} value={p.method} onChange={set('method')}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Cheque No.</label>
          <input className={inputCls} value={p.chequeNo} onChange={set('chequeNo')} />
        </div>
        <div>
          <label className="input-label">BPV No.</label>
          <input className={inputCls} value={p.bpvNo} onChange={set('bpvNo')} />
        </div>
        <div>
          <label className="input-label">Notes</label>
          <input className={inputCls} value={p.notes} onChange={set('notes')} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-2">
        <div className="text-sm text-slate-600">
          Allocated <span className="font-semibold text-slate-800">{formatAED(allocated)}</span>
          {' · '}
          <span className={remainder < 0 ? 'text-red-600 font-semibold' : remainder > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
            {remainder < 0 ? `Over by ${formatAED(-remainder)}` : `Unallocated ${formatAED(remainder)}`}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAlloc({})} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100">Clear</button>
          <button onClick={autoAllocate} disabled={num(p.amount) <= 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1">
            <HiLightningBolt className="w-3.5 h-3.5" /> Auto-allocate oldest first
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left font-semibold">Inv. Date</th>
              <th className="px-3 py-2 text-left font-semibold">Reference</th>
              <th className="px-3 py-2 text-right font-semibold">Open Balance</th>
              <th className="px-3 py-2 text-right font-semibold w-40">Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {openInvoices.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No open invoices. The whole payment will go on account.</td></tr>
            ) : openInvoices.map((inv) => {
              const on = alloc[inv.id] !== undefined;
              return (
                <tr key={inv.id} className={on ? 'bg-emerald-50/60' : ''}>
                  <td className="px-3 py-1.5"><input type="checkbox" checked={on} onChange={() => toggle(inv)} /></td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-3 py-1.5 font-medium text-slate-800">{inv.reference}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700">{formatAED(inv.balance)}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="0.01" max={inv.balance} className={`${inputCls} text-right`}
                      value={alloc[inv.id] ?? ''} placeholder="0.00"
                      onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={submit} disabled={saving} className="btn-gradient-blue flex items-center gap-2 disabled:opacity-60">
          <HiCheck className="w-5 h-5" /> {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Statement: one supplier
// ---------------------------------------------------------------------------
const emptyInvoice = () => ({ invoiceDate: todayISO(), dueDate: '', reference: '', description: 'SALES - CREDIT', amount: '', credit: '' });

function StatementView({ supplierId, onBack }) {
  const {
    data, loading, error, refresh, updateSupplier, deleteSupplier,
    addInvoices, updateInvoice, deleteInvoice, addPayment, deletePayment,
  } = useSupplierLedger(supplierId);

  const [filter, setFilter] = useState('open'); // open | overdue | paid | all
  const [search, setSearch] = useState('');
  const [newInv, setNewInv] = useState(emptyInvoice());
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editSupplier, setEditSupplier] = useState(false);

  const invoices = data?.invoices || [];
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (filter === 'open' && i.balance <= 0) return false;
      if (filter === 'overdue' && !i.overdue) return false;
      if (filter === 'paid' && i.balance > 0) return false;
      if (q && !`${i.reference} ${i.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, filter, search]);
  const shownTotals = useMemo(() => shown.reduce((a, i) => ({
    amount: a.amount + i.amount, credit: a.credit + i.credit, paid: a.paid + i.paid, balance: a.balance + i.balance,
  }), { amount: 0, credit: 0, paid: 0, balance: 0 }), [shown]);

  if (loading && !data) return <div className="min-h-screen bg-slate-50 text-center text-slate-400 py-24">Loading...</div>;
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-center py-24">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={onBack} className="text-blue-600 hover:underline">Back to all suppliers</button>
      </div>
    );
  }

  const { supplier, totals } = data;

  const handleAddInvoice = async () => {
    if (!newInv.reference.trim() || num(newInv.amount) <= 0) { alert('Enter the invoice reference and amount.'); return; }
    setSaving(true);
    const res = await addInvoices({
      supplierId, ...newInv,
      reference: newInv.reference.trim(), amount: num(newInv.amount), credit: num(newInv.credit),
    });
    setSaving(false);
    if (res.success) setNewInv(emptyInvoice());
    else alert(res.error || 'Failed to add invoice');
  };

  const startEdit = (i) => {
    setEditingId(i.id);
    setEditRow({
      invoiceDate: i.invoiceDate, dueDate: i.dueDate, reference: i.reference, description: i.description,
      amount: String(i.amount), credit: String(i.credit || ''),
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };
  const saveEdit = async () => {
    setSaving(true);
    const res = await updateInvoice(editingId, { ...editRow, amount: num(editRow.amount), credit: num(editRow.credit) });
    setSaving(false);
    if (res.success) cancelEdit();
    else alert(res.error || 'Failed to update invoice');
  };
  const handleDeleteInvoice = async (i) => {
    if (!window.confirm(`Delete invoice ${i.reference} (AED ${formatAED(i.amount)})?`)) return;
    const res = await deleteInvoice(i.id);
    if (!res.success) alert(res.error || 'Failed to delete invoice');
  };
  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete the AED ${formatAED(p.amount)} payment of ${fmtDate(p.paymentDate)}? The invoices it paid will be re-opened.`)) return;
    const res = await deletePayment(p.id);
    if (!res.success) alert(res.error || 'Failed to delete payment');
  };
  const handleDeleteSupplier = async () => {
    if (!window.confirm(`Delete supplier ${supplier.name}?`)) return;
    const res = await deleteSupplier(supplier.id);
    if (res.success) onBack();
    else alert(res.error || 'Failed to delete supplier');
  };

  // --- Print / Save as PDF: laid out like the supplier's statement ---
  const handlePrint = () => {
    const open = invoices.filter((i) => i.balance > 0);
    const rows = open.map((i) => `<tr>
      <td>${fmtDate(i.invoiceDate)}</td><td class="l">${esc(i.reference)}</td><td class="l">${esc(i.description)}</td>
      <td>${fmtDate(i.dueDate)}</td><td>${formatAED(i.amount)}</td><td>${i.credit || i.paid ? formatAED(i.credit + i.paid) : ''}</td>
      <td class="b">${formatAED(i.balance)}</td></tr>`).join('');
    const sum = open.reduce((a, i) => ({ d: a.d + i.amount, c: a.c + i.credit + i.paid, b: a.b + i.balance }), { d: 0, c: 0, b: 0 });
    const html = `<!DOCTYPE html><html><head><title>Statement - ${esc(supplier.name)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 10.5px; }
  h1 { font-size: 16px; margin: 0; } h2 { font-size: 13px; text-align: center; text-decoration: underline; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: right; }
  th { background: #f1f5f9; font-size: 9.5px; } td.l, th.l { text-align: left; } td.b { font-weight: bold; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .age td, .age th { text-align: center; }
  .tot { text-align: right; font-size: 13px; font-weight: bold; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <h2>SUPPLIER STATEMENT (OUTSTANDING)</h2>
  <div class="row"><div><b>${esc(supplier.name)}</b>${supplier.code ? ` (our a/c ${esc(supplier.code)})` : ''}</div>
    <div>As on: <b>${fmtDate(data.asOf)}</b></div></div>
  <table><thead><tr><th>Inv. Date</th><th class="l">Reference</th><th class="l">Description</th><th>Due Date</th>
    <th>Debit</th><th>Credit / Paid</th><th>Balance</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" class="l">Total (${open.length} invoices)</td><td>${formatAED(sum.d)}</td>
      <td>${formatAED(sum.c)}</td><td>${formatAED(sum.b)}</td></tr></tfoot></table>
  <table class="age"><thead><tr>${BUCKETS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody><tr>${BUCKETS.map(([k]) => `<td>${totals.ageing[k] ? formatAED(totals.ageing[k]) : ''}</td>`).join('')}
      <td><b>${formatAED(sum.b)}</b></td></tr></tbody></table>
  ${totals.unallocated ? `<div class="tot">Less paid on account: ${formatAED(totals.unallocated)}</div>` : ''}
  <div class="tot">Total Outstanding: AED ${formatAED(totals.outstanding)}</div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Popup blocked. Allow popups for this site to print the statement.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const statusPill = (i) => {
    if (i.balance <= 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Paid</span>;
    if (i.overdue) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">Overdue {i.daysOverdue}d</span>;
    if (i.dueSoon) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">Due soon</span>;
    if (i.status === 'Partial') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Partial</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Open</span>;
  };
  const rowTone = (i) => (i.balance <= 0 ? 'text-slate-400' : i.overdue ? 'bg-red-50/40' : i.dueSoon ? 'bg-amber-50/50' : '');

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title={supplier.name}
        subtitle={`Supplier statement as on ${fmtDate(data.asOf)}`}
        icon={HiScale}
        onAction={handlePrint}
        actionLabel="Print Statement"
        actionIcon={HiPrinter}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <HiArrowLeft className="w-4 h-4" /> All suppliers
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {supplier.code && <span>A/c {supplier.code}</span>}
            <span>· {supplier.paymentTermsDays ? `${supplier.paymentTermsDays}-day terms` : 'Due on invoice date'}</span>
            {supplier.phone && <span>· {supplier.phone}</span>}
            <button onClick={() => setEditSupplier((v) => !v)} className="ml-2 p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit supplier">
              <HiPencil className="w-4 h-4" />
            </button>
            <button onClick={handleDeleteSupplier} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete supplier">
              <HiTrash className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editSupplier && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <SupplierForm
              saveLabel="Save Supplier"
              initial={{ ...supplier, paymentTermsDays: String(supplier.paymentTermsDays) }}
              onCancel={() => setEditSupplier(false)}
              onSave={async (s) => {
                const res = await updateSupplier(supplier.id, s);
                if (res.success) setEditSupplier(false);
                return res;
              }}
            />
            <p className="text-xs text-slate-400 mt-2">Credit terms apply to invoices added from now on (due date = invoice date + terms).</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi icon={HiScale} label="Outstanding" value={`AED ${formatAED(totals.outstanding)}`}
            sub={`${totals.openCount} open invoices${totals.unallocated ? ` · ${formatAED(totals.unallocated)} on account` : ''}`} />
          <Kpi icon={HiExclamation} label="Overdue" value={`AED ${formatAED(totals.overdue)}`} tone="text-red-600"
            sub={`${totals.overdueCount} invoices`} />
          <Kpi icon={HiClock} label="Due in 7 days" value={`AED ${formatAED(totals.dueSoon)}`} tone="text-amber-600"
            sub={totals.nextDue ? `Next due ${fmtDate(totals.nextDue)}` : undefined} />
          <Kpi icon={HiCash} label="Paid to date" value={`AED ${formatAED(totals.paid)}`} tone="text-emerald-600"
            sub={totals.lastPayment ? `Last ${fmtDate(totals.lastPayment)}` : 'No payments yet'} />
        </div>

        <AgeingStrip ageing={totals.ageing} />

        {showImport && (
          <ImportPanel
            suppliers={[supplier]}
            presetSupplierId={supplier.id}
            onClose={() => setShowImport(false)}
            onDone={() => { setShowImport(false); refresh(); }}
          />
        )}
        {showPay ? (
          <PaymentPanel supplierId={supplier.id} invoices={invoices} onSave={addPayment} onClose={() => setShowPay(false)} />
        ) : (
          <div className="flex justify-end gap-2 mb-4">
            {!showImport && (
              <button onClick={() => setShowImport(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-2">
                <HiUpload className="w-5 h-5" /> Import Statement
              </button>
            )}
            <button onClick={() => setShowPay(true)} className="btn-gradient-blue flex items-center gap-2">
              <HiCash className="w-5 h-5" /> Record Payment
            </button>
          </div>
        )}

        {/* Add invoice */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HiPlus className="w-4 h-4" /> Add Invoice
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div>
              <label className="input-label">Inv. Date</label>
              <input type="date" className={inputCls} value={newInv.invoiceDate}
                onChange={(e) => setNewInv((r) => ({ ...r, invoiceDate: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Reference</label>
              <input className={inputCls} value={newInv.reference} placeholder="Supplier inv no."
                onChange={(e) => setNewInv((r) => ({ ...r, reference: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="input-label">Description</label>
              <input className={inputCls} value={newInv.description}
                onChange={(e) => setNewInv((r) => ({ ...r, description: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Due Date</label>
              <input type="date" className={inputCls} value={newInv.dueDate} title="Blank = invoice date + credit terms"
                onChange={(e) => setNewInv((r) => ({ ...r, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Amount (AED)</label>
              <input type="number" step="0.01" className={inputCls} value={newInv.amount}
                onChange={(e) => setNewInv((r) => ({ ...r, amount: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddInvoice} disabled={saving} className="btn-gradient-blue w-full flex items-center justify-center gap-2 disabled:opacity-60">
                <HiPlus className="w-5 h-5" /> {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>

        {/* Invoice table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-100">
            <div className="flex gap-1">
              {[['open', 'Open'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']].map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input className={`${inputCls} pl-8 w-56`} placeholder="Search reference..." value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-3 py-3 text-left font-semibold">Inv. Date</th>
                  <th className="px-3 py-3 text-left font-semibold">Reference</th>
                  <th className="px-3 py-3 text-left font-semibold">Description</th>
                  <th className="px-3 py-3 text-left font-semibold">Due Date</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 text-right font-semibold">Credit</th>
                  <th className="px-3 py-3 text-right font-semibold">Paid</th>
                  <th className="px-3 py-3 text-right font-semibold">Balance</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No invoices match.</td></tr>
                ) : shown.map((i) => (editingId === i.id ? (
                  <tr key={i.id} className="bg-blue-50/50">
                    <td className="px-2 py-2"><input type="date" className={inputCls} value={editRow.invoiceDate}
                      onChange={(e) => setEditRow((s) => ({ ...s, invoiceDate: e.target.value }))} /></td>
                    <td className="px-2 py-2"><input className={inputCls} value={editRow.reference}
                      onChange={(e) => setEditRow((s) => ({ ...s, reference: e.target.value }))} /></td>
                    <td className="px-2 py-2"><input className={inputCls} value={editRow.description}
                      onChange={(e) => setEditRow((s) => ({ ...s, description: e.target.value }))} /></td>
                    <td className="px-2 py-2"><input type="date" className={inputCls} value={editRow.dueDate}
                      onChange={(e) => setEditRow((s) => ({ ...s, dueDate: e.target.value }))} /></td>
                    <td className="px-2 py-2"><input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.amount}
                      onChange={(e) => setEditRow((s) => ({ ...s, amount: e.target.value }))} /></td>
                    <td className="px-2 py-2"><input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.credit}
                      onChange={(e) => setEditRow((s) => ({ ...s, credit: e.target.value }))} /></td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatAED(i.paid)}</td>
                    <td className="px-3 py-2" colSpan={2} />
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={saveEdit} disabled={saving} title="Save" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><HiCheck className="w-4 h-4" /></button>
                        <button onClick={cancelEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><HiX className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={i.id} className={`hover:bg-slate-50 ${rowTone(i)}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(i.invoiceDate)}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{i.reference}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{i.description}</td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${i.overdue ? 'text-red-600 font-medium' : ''}`}>{fmtDate(i.dueDate)}</td>
                    <td className="px-3 py-2.5 text-right">{formatAED(i.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{i.credit ? formatAED(i.credit) : ''}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{i.paid ? formatAED(i.paid) : ''}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatAED(i.balance)}</td>
                    <td className="px-3 py-2.5">{statusPill(i)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(i)} title="Edit" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><HiPencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteInvoice(i)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><HiTrash className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
              {shown.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                    <td className="px-3 py-3" colSpan={4}>Total ({shown.length})</td>
                    <td className="px-3 py-3 text-right">{formatAED(shownTotals.amount)}</td>
                    <td className="px-3 py-3 text-right">{formatAED(shownTotals.credit)}</td>
                    <td className="px-3 py-3 text-right text-emerald-600">{formatAED(shownTotals.paid)}</td>
                    <td className="px-3 py-3 text-right">{formatAED(shownTotals.balance)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Payments history */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-semibold text-slate-700 p-4 pb-2 flex items-center gap-2">
            <HiCash className="w-4 h-4" /> Payments ({data.payments.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold">Method</th>
                  <th className="px-4 py-2 text-left font-semibold">Cheque / BPV</th>
                  <th className="px-4 py-2 text-left font-semibold">Paid Invoices</th>
                  <th className="px-4 py-2 text-right font-semibold">On Account</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payments.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No payments recorded.</td></tr>
                ) : data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatAED(p.amount)}</td>
                    <td className="px-4 py-2.5">{p.method || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {[p.chequeNo && `Chq ${p.chequeNo}`, p.bpvNo && `BPV ${p.bpvNo}`].filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {p.allocations.length === 0 ? '-' : p.allocations.map((a) => `${a.reference} (${formatAED(a.amount)})`).join(', ')}
                      {p.notes && <div className="text-slate-400 mt-0.5">{p.notes}</div>}
                    </td>
                    <td className={`px-4 py-2.5 text-right ${p.unallocated > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{formatAED(p.unallocated)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDeletePayment(p)} title="Delete payment" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><HiTrash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierLedgerPage() {
  const [params, setParams] = useSearchParams();
  const supplierId = params.get('supplier') ? Number(params.get('supplier')) : null;
  const openSupplier = (id) => setParams({ supplier: String(id) });
  const back = () => setParams({});
  return supplierId
    ? <StatementView key={supplierId} supplierId={supplierId} onBack={back} />
    : <SummaryView openSupplier={openSupplier} />;
}

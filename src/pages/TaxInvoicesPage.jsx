import React, { useState, useMemo, useEffect } from 'react';
import { HiDocumentText, HiChevronLeft, HiChevronRight, HiPlus, HiTrash, HiPencil, HiCheck, HiX, HiDownload } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import { useTaxInvoices } from '../hooks/useTaxInvoices';
import { getPrevMonth } from '../utils/prevMonth';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const VAT_RATE = 0.05;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

const formatAED = (amount) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

// invoiceDate is stored MM/DD/YYYY (PDC convention). Native <input type="date">
// wants YYYY-MM-DD — convert both ways.
const toISO = (mmddyyyy) => {
  if (!mmddyyyy) return '';
  const [m, d, y] = mmddyyyy.split('/');
  if (!m || !d || !y) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const fromISO = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
};
const formatDate = (mmddyyyy) => {
  const iso = toISO(mmddyyyy);
  if (!iso) return mmddyyyy || '-';
  const dt = new Date(iso);
  return isNaN(dt) ? mmddyyyy : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Auto-VAT: editing Amount(no VAT) fills VAT at 5% and Amount-with-VAT;
// editing VAT recomputes with-VAT; editing with-VAT back-derives VAT.
// Every field stays freely editable.
function recalc(row, field, value) {
  const next = { ...row, [field]: value };
  const noVat = num(next.amountNoVat);
  if (field === 'amountNoVat') {
    next.vat = String(round2(noVat * VAT_RATE));
    next.amountWithVat = String(round2(noVat + round2(noVat * VAT_RATE)));
  } else if (field === 'vat') {
    next.amountWithVat = String(round2(noVat + num(next.vat)));
  } else if (field === 'amountWithVat') {
    next.vat = String(round2(num(next.amountWithVat) - noVat));
  }
  return next;
}

const emptyRow = (month, year) => ({
  // default the date to the 1st of the selected month so it lands in this tab
  invoiceDate: `${month + 1}/1/${year}`,
  company: '',
  amountNoVat: '',
  vat: '',
  amountWithVat: '',
  invoiceNumber: '',
});

export default function TaxInvoicesPage() {
  const prev = getPrevMonth();
  const [selectedMonth, setSelectedMonth] = useState(prev.month);
  const [selectedYear, setSelectedYear] = useState(prev.year);

  const { invoices, loading, error, add, update, remove } = useTaxInvoices(selectedMonth, selectedYear);

  const [newRow, setNewRow] = useState(emptyRow(prev.month, prev.year));
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // keep the add-form's default date in sync with the visible month
  useEffect(() => {
    setNewRow((r) => ({ ...r, invoiceDate: `${selectedMonth + 1}/1/${selectedYear}` }));
    setEditingId(null);
    setEditRow(null);
  }, [selectedMonth, selectedYear]);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };
  const goToPrevSalaryMonth = () => {
    const p = getPrevMonth();
    setSelectedMonth(p.month);
    setSelectedYear(p.year);
  };

  const totals = useMemo(() => invoices.reduce((acc, r) => ({
    noVat: acc.noVat + (r.amountNoVat || 0),
    vat: acc.vat + (r.vat || 0),
    withVat: acc.withVat + (r.amountWithVat || 0),
  }), { noVat: 0, vat: 0, withVat: 0 }), [invoices]);

  const handleAdd = async () => {
    if (!newRow.company.trim() && !num(newRow.amountNoVat)) {
      alert('Enter at least a company name or an amount.');
      return;
    }
    setSaving(true);
    const payload = {
      invoiceDate: newRow.invoiceDate,
      company: newRow.company.trim(),
      amountNoVat: num(newRow.amountNoVat),
      vat: num(newRow.vat),
      amountWithVat: num(newRow.amountWithVat),
      invoiceNumber: newRow.invoiceNumber.trim(),
    };
    const res = await add(payload);
    setSaving(false);
    if (res.success) {
      setNewRow(emptyRow(selectedMonth, selectedYear));
    } else {
      alert(res.error || 'Failed to add invoice');
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditRow({
      invoiceDate: r.invoiceDate,
      company: r.company,
      amountNoVat: String(r.amountNoVat ?? ''),
      vat: String(r.vat ?? ''),
      amountWithVat: String(r.amountWithVat ?? ''),
      invoiceNumber: r.invoiceNumber,
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };
  const saveEdit = async () => {
    setSaving(true);
    const payload = {
      invoiceDate: editRow.invoiceDate,
      company: editRow.company.trim(),
      amountNoVat: num(editRow.amountNoVat),
      vat: num(editRow.vat),
      amountWithVat: num(editRow.amountWithVat),
      invoiceNumber: editRow.invoiceNumber.trim(),
    };
    const res = await update(editingId, payload);
    setSaving(false);
    if (res.success) { cancelEdit(); }
    else alert(res.error || 'Failed to update invoice');
  };

  // --- Download as PDF (browser print dialog → "Save as PDF") ---
  const handleDownloadPdf = () => {
    if (invoices.length === 0) { alert('No invoices to download for this month.'); return; }
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bodyRows = invoices.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(r.invoiceDate))}</td>
        <td class="l">${esc(r.company || '-')}</td>
        <td>${formatAED(r.amountNoVat)}</td>
        <td>${formatAED(r.vat)}</td>
        <td class="net">${formatAED(r.amountWithVat)}</td>
        <td class="l">${esc(r.invoiceNumber || '-')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Tax Invoices ${MONTH_NAMES[selectedMonth]} ${selectedYear}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; }
  td.l, th.l { text-align: left; }
  td.net { font-weight: bold; }
  tfoot td { font-weight: bold; background: #f8fafc; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <div class="sub">Tax Invoices — ${MONTH_NAMES[selectedMonth]} ${selectedYear}
    &nbsp;·&nbsp; ${invoices.length} invoices &nbsp;·&nbsp; printed ${new Date().toLocaleDateString('en-GB')}</div>
  <table>
    <thead><tr>
      <th>SN</th><th>Date</th><th class="l">Company</th>
      <th>Amount (no VAT)</th><th>VAT</th><th>Amount (with VAT)</th><th class="l">Invoice #</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>
      <td colspan="3" class="l">TOTAL (${invoices.length} invoices)</td>
      <td>${formatAED(totals.noVat)}</td>
      <td>${formatAED(totals.vat)}</td>
      <td class="net">${formatAED(totals.withVat)}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Popup blocked — allow popups for this site to download the PDF.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete tax invoice from ${r.company || 'this company'}?`)) return;
    const res = await remove(r.id);
    if (!res.success) alert(res.error || 'Failed to delete invoice');
  };

  const inputCls = 'input-field py-1.5 text-sm';

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Tax Invoices"
        subtitle={`VAT record - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
        icon={HiDocumentText}
        onAction={handleDownloadPdf}
        actionLabel="Download PDF"
        actionIcon={HiDownload}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Month navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <button onClick={goToPrevMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <HiChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              >
                {MONTH_NAMES.map((name, idx) => (<option key={idx} value={idx}>{name}</option>))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
              {!isCurrentMonth && (
                <button onClick={goToPrevSalaryMonth} className="ml-2 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors">
                  This month
                </button>
              )}
            </div>
            <button onClick={goToNextMonth} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <HiChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500 uppercase">Amount (no VAT)</div>
            <div className="text-xl font-bold text-slate-800 mt-1">AED {formatAED(totals.noVat)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500 uppercase">VAT</div>
            <div className="text-xl font-bold text-amber-600 mt-1">AED {formatAED(totals.vat)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500 uppercase">Total (with VAT)</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">AED {formatAED(totals.withVat)}</div>
          </div>
        </div>

        {/* Add form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <HiPlus className="w-4 h-4" /> Add Tax Invoice
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label className="input-label">Date</label>
              <input type="date" className={inputCls} value={toISO(newRow.invoiceDate)}
                onChange={(e) => setNewRow((r) => ({ ...r, invoiceDate: fromISO(e.target.value) }))} />
            </div>
            <div className="md:col-span-2">
              <label className="input-label">Company</label>
              <input type="text" className={inputCls} placeholder="Supplier name" value={newRow.company}
                onChange={(e) => setNewRow((r) => ({ ...r, company: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Amount (no VAT)</label>
              <input type="number" step="0.01" className={inputCls} value={newRow.amountNoVat}
                onChange={(e) => setNewRow((r) => recalc(r, 'amountNoVat', e.target.value))} />
            </div>
            <div>
              <label className="input-label">VAT (5%)</label>
              <input type="number" step="0.01" className={inputCls} value={newRow.vat}
                onChange={(e) => setNewRow((r) => recalc(r, 'vat', e.target.value))} />
            </div>
            <div>
              <label className="input-label">Amount (with VAT)</label>
              <input type="number" step="0.01" className={inputCls} value={newRow.amountWithVat}
                onChange={(e) => setNewRow((r) => recalc(r, 'amountWithVat', e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
            <div className="md:col-span-2">
              <label className="input-label">Invoice #</label>
              <input type="text" className={inputCls} placeholder="INV-0001" value={newRow.invoiceNumber}
                onChange={(e) => setNewRow((r) => ({ ...r, invoiceNumber: e.target.value }))} />
            </div>
            <div className="md:col-span-4 flex items-end justify-end">
              <button onClick={handleAdd} disabled={saving} className="btn-gradient-blue flex items-center gap-2 disabled:opacity-60">
                <HiPlus className="w-5 h-5" /> {saving ? 'Saving...' : 'Add Invoice'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left font-semibold">SN</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount (no VAT)</th>
                  <th className="px-4 py-3 text-right font-semibold">VAT</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount (with VAT)</th>
                  <th className="px-4 py-3 text-left font-semibold">Invoice #</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-red-500">{error}</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No tax invoices for {MONTH_NAMES[selectedMonth]} {selectedYear}.</td></tr>
                ) : invoices.map((r) => (
                  editingId === r.id ? (
                    <tr key={r.id} className="bg-blue-50/50">
                      <td className="px-4 py-2 text-slate-500">{r.rowIndex}</td>
                      <td className="px-4 py-2">
                        <input type="date" className={inputCls} value={toISO(editRow.invoiceDate)}
                          onChange={(e) => setEditRow((s) => ({ ...s, invoiceDate: fromISO(e.target.value) }))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className={inputCls} value={editRow.company}
                          onChange={(e) => setEditRow((s) => ({ ...s, company: e.target.value }))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.amountNoVat}
                          onChange={(e) => setEditRow((s) => recalc(s, 'amountNoVat', e.target.value))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.vat}
                          onChange={(e) => setEditRow((s) => recalc(s, 'vat', e.target.value))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className={`${inputCls} text-right`} value={editRow.amountWithVat}
                          onChange={(e) => setEditRow((s) => recalc(s, 'amountWithVat', e.target.value))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className={inputCls} value={editRow.invoiceNumber}
                          onChange={(e) => setEditRow((s) => ({ ...s, invoiceNumber: e.target.value }))} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={saveEdit} disabled={saving} title="Save" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                            <HiCheck className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                            <HiX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{r.rowIndex}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(r.invoiceDate)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.company || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatAED(r.amountNoVat)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{formatAED(r.vat)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatAED(r.amountWithVat)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                            <HiPencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(r)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
              {invoices.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                    <td className="px-4 py-3" colSpan={3}>Total ({invoices.length})</td>
                    <td className="px-4 py-3 text-right">{formatAED(totals.noVat)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatAED(totals.vat)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatAED(totals.withVat)}</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HiClipboardList, HiUpload, HiPlus, HiTrash, HiDownload, HiX, HiRefresh, HiUserGroup, HiClock, HiPencil } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';

import { API_BASE } from '../services/apiBase';

const API = `${API_BASE}/job-order`;

const today = () => new Date().toISOString().split('T')[0];

const DEFAULT_TERMS = `1. Work Schedule and Delay Penalties
- The work must be completed in all respects as per the instructions and programmed schedule given by the Main Contractor. The Sub-Contractor must manage and organize their labor force to achieve maximum output for the given targets.
- Penalty: In case of any delay in work completion, a penalty of AED 100 per day (up to a maximum of 5% of the subcontract value) will be charged.
- Idle Equipment: Furthermore, if scaffolding or other equipment is kept idle at the site due to delayed or non-productive work by the Sub-Contractor, the corresponding cost will be charged to the Sub-Contractor.

2. Quality, Workmanship, and Testing
- Workmanship and quality of work should strictly meet the standards of the Main Contractor and the Consultant.
- If work is rejected due to poor workmanship or quality, the Sub-Contractor will re-do the job without any extra cost to the Main Contractor.
- Additional Testing: The Main Contractor may instruct additional tests. If materials or workmanship fail these tests, the Sub-Contractor bears all associated testing and rectification costs.

3. Material Care and Wastage
- The Sub-Contractor must take utmost care of all materials provided to them to avoid unnecessary wastage.
- In case there is any shortage of material due to their negligence, they will be solely responsible, and the corresponding cost will be deducted from their dues.

4. Material Shifting
- Required materials will be shifted by the Sub-Contractor as per their requirement provided on the same floor. The Main Contractor will not be responsible for material shifting.

5. Sub-Contracting, Visas, and Legal Compliance
- The Sub-Contractor cannot sub-contract the awarded work to any third party.
- All employees working on the job must be on their company sponsorship with valid visas.
- In case any fine or penalty is levied by local authorities due to non-compliance (including imprisonment), the cost will be borne entirely by the Sub-Contractor. The Main Contractor reserves the right to take legal action as per UAE labor law to recover imposed fines or losses.

6. Insurance, Safety, and Liability
- The Sub-Contractor is strictly responsible for the insurance cover of their labor and materials at the site.
- They must abide by all safety rules and regulations laid out by local authorities and conduct regular safety checks on their laborers, especially in critical areas, to avoid fatal incidents.
- Absolute Liability: Any mishaps or fatal incidents involving laborers working at the site are the sole responsibility of the Sub-Contractor. They will bear all resulting consequences for legal action and will bear all penalties/fines imposed by local authorities or government entities (including Dubai Courts). Also, any penalty/fine imposed on the Main Contractor due to the Sub-Contractor's violations will be borne by the Sub-Contractor.

7. Personal Protective Equipment (PPE) & Staffing Controls
- Laborers deployed at the site must wear minimum required PPE. If they require coveralls and other safety equipment provided by the Main Contractor, the corresponding cost will be deducted from their due payments.
- Management: The Sub-Contractor must appoint approved, organized staff (Project Manager and Foremen). The Main Contractor reserves the right to dismiss any staff from the site for poor performance or misbehavior, requiring immediate replacement.

8. Site Cleanliness and Debris Dumping
- The Sub-Contractor must collect and dump debris/waste materials accumulated from their works at a place allocated by the Main Contractor on a daily basis.
- Penalty: Failure to maintain continuous site cleanliness will result in a direct deduction of AED 250 daily against cleaning costs from the Sub-Contractor's payment.

9. Project Suspension or Termination by Client
- In case the project is kept on hold, suspended, or terminated as per the instructions of the Client, the Main Contractor will have the right to terminate the job of the Sub-Contractor without any reimbursement of loss of compensation whatsoever. All unpaid amounts will be paid strictly as per the Consultant/Main Contractor certified amount.

10. Default and Abandonment of Work
- If the Sub-Contractor stops the work, desires to leave it, or if the job carried out is not up to the required standards (or progress falls behind schedule), the Main Contractor has the right to issue a 15-day notice, terminate the Sub-Contractor, and appoint another sub-contractor completely at the original Sub-Contractor's risk and cost.
- No claims from the Sub-Contractor will be entertained in the future under any circumstances.

11. Meetings and Documentation (Administrative Duties)
- Sub-Contractor representatives must attend all scheduled site progress meetings; an amount of AED 500 will be deducted for each unexcused absence.
- All payments will be withheld if required Guarantee certificates and "As Built" drawings are not submitted upon completion.

12. Payment Terms
- 45 days after submitting the invoice

13. No Retention as agreed`;

const emptyJobOrder = (refNumber) => ({
  refNumber: refNumber || '',
  projectCode: '',
  date: today(),
  project: '',
  sub: '',
  quoteDate: '',
  subcontractor: { name: '', contact: '', phone: '', address: '' },
  lineItems: [{ description: '', quantity: 0, unitPrice: 0, amount: 0 }],
  hasUnitPricing: false,
  discount: 0,
  vatEnabled: true,
  vatPercent: 5,
  showTotals: true,
  termsText: DEFAULT_TERMS,
});

function calcTotals(lineItems, vatEnabled, vatPercent, discount) {
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const disc = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const net = subtotal - disc;
  const vatAmount = vatEnabled ? net * (parseFloat(vatPercent) || 0) / 100 : 0;
  return { subtotal, discount: disc, net, vatAmount, total: net + vatAmount };
}

// ── Subcontractor Manager Modal ─────────────────────────────────────────────
function SubcontractorModal({ subs, onClose, onAdd, onDelete, onSelect }) {
  const [newName, setNewName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HiUserGroup className="text-violet-500" /> Subcontractors
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="input-field flex-1"
            placeholder="New subcontractor name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onAdd(newName.trim()); setNewName(''); } }}
          />
          <button
            className="btn-gradient-blue px-3 py-2"
            onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); } }}
          >
            <HiPlus className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {subs.length === 0 && <li className="text-sm text-slate-400 text-center py-4">No subcontractors yet</li>}
          {subs.map((s, i) => (
            <li key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <button
                className="text-sm text-slate-700 hover:text-blue-600 text-left flex-1"
                onClick={() => { onSelect(s); onClose(); }}
              >
                {s}
              </button>
              <button className="text-red-400 hover:text-red-600 ml-2" onClick={() => onDelete(i)}>
                <HiTrash className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
function JobOrderHistoryPanel({ onClose, onEdit }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await fetch(`${API}/records?${params.toString()}`);
      const d = await res.json();
      if (d.success) {
        setRecords(d.records);
      } else {
        setError(d.error || 'Could not load Job Order history');
      }
    } catch (e) {
      setError(e.message || 'Could not load Job Order history');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const deleteRecord = async (record) => {
    if (!window.confirm(`Delete Job Order ${record.ref_number}? This cannot be undone.`)) return;
    const res = await fetch(`${API}/records/${record.id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) setRecords(prev => prev.filter(r => r.id !== record.id));
  };

  const downloadRecord = async (record) => {
    const res = await fetch(`${API}/records/${record.id}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.ref_number.replace(/\//g, '-').replace(/\s+/g, '')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HiClock className="text-violet-500" /> Job Order History
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="input-field sm:col-span-1"
            placeholder="Search subcontractor, project, ref no..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <div className="text-sm text-slate-400 text-center py-8">Loading...</div>}
          {!loading && error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg text-center py-3 px-4">{error}</div>
          )}
          {!loading && !error && records.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-8">No records found</div>
          )}
          {!loading && !error && records.map(r => (
            <div key={r.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono font-bold text-sm text-slate-800">{r.ref_number}</div>
                <div className="text-sm text-slate-600 truncate">{r.subcontractor_name}</div>
                <div className="text-xs text-slate-400 truncate">{r.project}</div>
                <div className="text-xs text-slate-400">{r.jo_date}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium text-slate-700 text-sm">
                  {r.show_totals === false
                    ? <span className="text-slate-400 font-normal">Rates only</span>
                    : `AED ${(parseFloat(r.total_amount) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`}
                </span>
                <button onClick={() => downloadRecord(r)} title="Download" className="text-blue-500 hover:text-blue-700">
                  <HiDownload className="w-4 h-4" />
                </button>
                <button onClick={() => onEdit(r)} title="Edit" className="text-slate-500 hover:text-slate-700">
                  <HiPencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteRecord(r)} title="Delete" className="text-red-400 hover:text-red-600">
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Qty may be a number or text such as "Per Sqft" (rate-only quotes).
const isNumericQty = (q) => String(q ?? '').trim() !== '' && !isNaN(Number(q));
const isTextQty = (q) => String(q ?? '').trim() !== '' && !isNumericQty(q);

// ── Line Items Table ──────────────────────────────────────────────────────────
function LineItemsTable({ items, hasUnitPricing, onChangeItems, onToggleUnitPricing }) {
  const update = (idx, field, val) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: val };
      if (hasUnitPricing && (field === 'quantity' || field === 'unitPrice')) {
        next.amount = isNumericQty(next.quantity)
          ? Number(next.quantity) * (parseFloat(next.unitPrice) || 0)
          : 0;
      }
      return next;
    });
    onChangeItems(updated);
  };

  const addRow = () => onChangeItems([...items, { description: '', quantity: 0, unitPrice: 0, amount: 0 }]);
  const removeRow = (idx) => onChangeItems(items.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
        <input
          type="checkbox"
          checked={hasUnitPricing}
          onChange={e => onToggleUnitPricing(e.target.checked)}
        />
        This quote has Qty / Unit Price columns (uncheck for a lump-sum quote)
      </label>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="py-2 px-3 text-center w-8">#</th>
              <th className="py-2 px-3 text-left">Description</th>
              {hasUnitPricing && <th className="py-2 px-3 text-center w-20">Qty</th>}
              {hasUnitPricing && <th className="py-2 px-3 text-right w-28">Unit Price</th>}
              <th className="py-2 px-3 text-right w-28">Amount</th>
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="py-1 px-3 text-center text-slate-500">{i + 1}</td>
                <td className="py-1 px-2">
                  <input
                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm"
                    value={item.description}
                    onChange={e => update(i, 'description', e.target.value)}
                    placeholder="Item description..."
                  />
                </td>
                {hasUnitPricing && (
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm text-center"
                      value={item.quantity}
                      onChange={e => update(i, 'quantity', e.target.value)}
                      placeholder="0 / Per Sqft"
                      title="A number, or text such as Per Sqft for a rate-only line"
                    />
                  </td>
                )}
                {hasUnitPricing && (
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm text-right"
                      value={item.unitPrice}
                      onChange={e => update(i, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </td>
                )}
                <td className="py-1 px-2">
                  {hasUnitPricing ? (
                    <div className="text-right font-medium text-slate-700 px-1">
                      {isTextQty(item.quantity)
                        ? '-'
                        : (parseFloat(item.amount) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm text-right"
                      value={item.amount}
                      onChange={e => update(i, 'amount', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  )}
                </td>
                <td className="py-1 px-1">
                  {items.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600">
                      <HiTrash className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        <HiPlus className="w-4 h-4" /> Add Row
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JobOrderPage() {
  const [jo, setJo] = useState(null);
  const [subs, setSubs] = useState([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [extracted, setExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const fetchNextNumber = (projectCode) =>
    fetch(`${API}/next-number?project_code=${encodeURIComponent(projectCode || '')}`).then(r => r.json());

  // Load next number and subcontractors on mount
  useEffect(() => {
    fetchNextNumber('').then(d => {
      if (d.success) setJo(emptyJobOrder(d.ref_number));
    }).catch(() => setJo(emptyJobOrder('')));

    fetch(`${API}/subcontractors`).then(r => r.json()).then(d => {
      if (d.success) setSubs(d.subcontractors);
    });
  }, []);

  const setField = (path, val) => {
    setJo(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
      return next;
    });
  };

  const refreshRefNumber = async (projectCode) => {
    const d = await fetchNextNumber(projectCode);
    if (d.success) setJo(prev => ({ ...prev, refNumber: d.ref_number }));
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setExtracting(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/extract`, { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Extraction failed');
      const d = json.data;

      const hasUnitPricing = !!d.has_unit_pricing;

      setExtracted(true);
      setJo(prev => ({
        ...(prev || emptyJobOrder('')),
        subcontractor: {
          name: d.subcontractor_name || '',
          contact: d.subcontractor_contact || '',
          phone: d.subcontractor_phone || '',
          address: d.subcontractor_address || '',
        },
        lineItems: (d.line_items || []).map(li => ({
          description: li.description || '',
          quantity: li.quantity || 0,
          unitPrice: li.unit_price || 0,
          amount: li.total_price || 0,
        })),
        hasUnitPricing,
        quoteDate: d.quotation_date || '',
        discount: d.discount || 0,
        vatPercent: d.vat_percent || 5,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const addSub = async (name) => {
    const res = await fetch(`${API}/subcontractors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await res.json();
    if (d.success) setSubs(d.subcontractors);
  };

  const deleteSub = async (idx) => {
    const res = await fetch(`${API}/subcontractors/${idx}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) setSubs(d.subcontractors);
  };

  const generatePDF = async () => {
    if (!jo) return;
    setGenerating(true);
    setError(null);
    try {
      const payload = {
        job_order: {
          ref_number: jo.refNumber,
          project_code: jo.projectCode,
          date: jo.date,
          project: jo.project,
          sub: jo.sub,
          quote_date: jo.quoteDate,
          has_unit_pricing: jo.hasUnitPricing,
          discount: parseFloat(jo.discount) || 0,
          vat_enabled: jo.vatEnabled,
          vat_percent: parseFloat(jo.vatPercent) || 0,
          show_totals: jo.showTotals,
        },
        subcontractor: {
          name: jo.subcontractor.name,
          contact: jo.subcontractor.contact,
          phone: jo.subcontractor.phone,
          address: jo.subcontractor.address,
        },
        line_items: jo.lineItems.map(li => ({
          description: li.description,
          quantity: isTextQty(li.quantity) ? String(li.quantity).trim() : (parseFloat(li.quantity) || 0),
          unit_price: parseFloat(li.unitPrice) || 0,
          amount: parseFloat(li.amount) || 0,
        })),
        terms_text: jo.termsText,
      };

      const url = editingId ? `${API}/records/${editingId}` : `${API}/pdf`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PDF generation failed');
      }

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `${jo.refNumber.replace(/\//g, '-').replace(/\s+/g, '')}.pdf`;
      a.click();
      URL.revokeObjectURL(dlUrl);

      if (editingId) {
        // Saved an edit to a past record — exit edit mode and return to a fresh form.
        setEditingId(null);
        await resetForm();
      } else {
        // Load next number for next Job Order
        await refreshRefNumber(jo.projectCode);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = async () => {
    const d = await fetchNextNumber('');
    setJo(emptyJobOrder(d.success ? d.ref_number : ''));
    setError(null);
  };

  const cancelEdit = async () => {
    setEditingId(null);
    await resetForm();
  };

  const startEdit = async (record) => {
    const res = await fetch(`${API}/records/${record.id}`);
    const d = await res.json();
    if (!d.success) { setError(d.error || 'Could not load record'); return; }
    const r = d.record;
    setJo({
      refNumber: r.ref_number || '',
      projectCode: r.project_code || '',
      date: r.jo_date || today(),
      project: r.project || '',
      sub: r.sub_scope || '',
      quoteDate: r.quote_date || '',
      subcontractor: {
        name: r.subcontractor_name || '', contact: r.subcontractor_contact || '',
        phone: r.subcontractor_phone || '', address: r.subcontractor_address || '',
      },
      lineItems: (r.line_items || []).map(li => ({
        description: li.description || '', quantity: li.quantity || 0,
        unitPrice: li.unit_price || 0, amount: li.amount || 0,
      })),
      hasUnitPricing: !!r.has_unit_pricing,
      discount: parseFloat(r.discount) || 0,
      vatEnabled: r.vat_enabled !== false,
      vatPercent: r.vat_percent == null ? 5 : parseFloat(r.vat_percent),
      showTotals: r.show_totals !== false,
      termsText: r.terms_text == null ? DEFAULT_TERMS : r.terms_text,
    });
    setEditingId(record.id);
    setShowHistory(false);
    setExtracted(false);
    setError(null);
  };

  if (!jo) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  const { subtotal, discount, net, vatAmount, total } = calcTotals(jo.lineItems, jo.vatEnabled, jo.vatPercent, jo.discount);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Job Order Generator"
        subtitle="Work Orders for Subcontractors"
        icon={HiClipboardList}
        onAction={cancelEdit}
        actionLabel="New Job Order"
        actionIcon={HiRefresh}
      />

      {showSubModal && (
        <SubcontractorModal
          subs={subs}
          onClose={() => setShowSubModal(false)}
          onAdd={addSub}
          onDelete={deleteSub}
          onSelect={s => setField('subcontractor.name', s)}
        />
      )}

      {showHistory && (
        <JobOrderHistoryPanel
          onClose={() => setShowHistory(false)}
          onEdit={startEdit}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <div className="flex justify-end -mb-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-violet-600 font-medium"
          >
            <HiClock className="w-4 h-4" /> History
          </button>
        </div>

        {/* Editing banner */}
        {editingId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-blue-800">
            <span>Editing <strong>{jo.refNumber}</strong></span>
            <button onClick={cancelEdit} className="text-blue-600 hover:text-blue-800 font-medium">Cancel Edit</button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}><HiX className="w-4 h-4" /></button>
          </div>
        )}

        {/* Post-extraction reminder */}
        {extracted && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-amber-800">
            <span>✓ Quotation extracted — now fill in <strong>Project</strong>, <strong>Sub (scope)</strong>, <strong>Ref project code</strong> &amp; review <strong>Terms &amp; Conditions</strong> before generating.</span>
            <button onClick={() => setExtracted(false)}><HiX className="w-4 h-4" /></button>
          </div>
        )}

        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'
          } ${extracting ? 'pointer-events-none opacity-60' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf,.webp"
            onChange={e => handleFile(e.target.files[0])}
          />
          {extracting ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-slate-500">Extracting data from quotation...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <HiUpload className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">Drop subcontractor quotation here or click to upload</p>
              <p className="text-xs text-slate-400">Supports JPG, PNG, PDF — AI fills subcontractor info &amp; line items. You fill Project, Sub &amp; Ref project code.</p>
            </div>
          )}
        </div>

        {/* Job Order Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Job Order Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Project Code</label>
              <input
                className="input-field"
                value={jo.projectCode}
                onChange={e => {
                  const code = e.target.value;
                  setField('projectCode', code);
                  refreshRefNumber(code);
                }}
                placeholder="e.g. S 108"
              />
            </div>
            <div>
              <label className="input-label">Ref Number</label>
              <input
                className={`input-field font-mono font-bold ${editingId ? 'bg-slate-50' : ''}`}
                value={jo.refNumber}
                onChange={e => setField('refNumber', e.target.value)}
                readOnly={!!editingId}
                title={editingId ? 'Ref Number is locked while editing — it identifies the saved record and cannot be changed.' : undefined}
              />
            </div>
            <div>
              <label className="input-label">Date</label>
              <input type="date" className="input-field" value={jo.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Project</label>
              <input
                className="input-field"
                value={jo.project}
                onChange={e => setField('project', e.target.value)}
                placeholder="Full project description..."
              />
            </div>
            <div>
              <label className="input-label">Quote Date</label>
              <input type="date" className="input-field" value={jo.quoteDate} onChange={e => setField('quoteDate', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="input-label">Sub (Trade / Scope of Work)</label>
              <input
                className="input-field"
                value={jo.sub}
                onChange={e => setField('sub', e.target.value)}
                placeholder="e.g. Plumbing work (LABOUR CHARGE ONLY)"
              />
            </div>
          </div>
        </div>

        {/* Subcontractor Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Subcontractor</h2>
            <button
              onClick={() => setShowSubModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <HiUserGroup className="w-4 h-4" /> Saved Subcontractors
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Subcontractor Name</label>
              <input className="input-field" value={jo.subcontractor.name} onChange={e => setField('subcontractor.name', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Contact Person (Att)</label>
              <input className="input-field" value={jo.subcontractor.contact} onChange={e => setField('subcontractor.contact', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input className="input-field" value={jo.subcontractor.phone} onChange={e => setField('subcontractor.phone', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Address</label>
              <input className="input-field" value={jo.subcontractor.address} onChange={e => setField('subcontractor.address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Line Items</h2>
          <LineItemsTable
            items={jo.lineItems}
            hasUnitPricing={jo.hasUnitPricing}
            onChangeItems={items => setJo(prev => ({ ...prev, lineItems: items }))}
            onToggleUnitPricing={val => setJo(prev => ({ ...prev, hasUnitPricing: val }))}
          />
        </div>

        {/* Terms & Conditions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Terms &amp; Conditions</h2>
          <p className="text-xs text-slate-400 mb-3">
            Pre-filled with the standard 13-clause terms. Edit freely — e.g. update the delay penalty rate in clause 1
            or the payment terms in clause 12 for this specific job order.
          </p>
          <textarea
            className="input-field font-mono text-xs resize-y"
            rows={16}
            value={jo.termsText}
            onChange={e => setField('termsText', e.target.value)}
          />
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 max-w-md ml-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Totals</h2>
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={jo.showTotals}
                onChange={e => setField('showTotals', e.target.checked)}
              />
              Include totals on the PDF
            </label>
          </div>
          {!jo.showTotals && (
            <p className="text-xs text-slate-400">
              No totals block on this job order — rates only.
            </p>
          )}
          {jo.showTotals && <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">AED {subtotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-2">
                Discount (AED)
                <input
                  type="number"
                  className="w-24 border border-slate-200 rounded px-1 py-0.5 text-xs text-right"
                  value={jo.discount}
                  onChange={e => setField('discount', e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </span>
              <span className="font-medium text-red-600">
                {discount > 0 ? `- AED ${discount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : 'AED 0.00'}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
                <span>Net</span>
                <span className="font-medium">AED {net.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={jo.vatEnabled}
                  onChange={e => setField('vatEnabled', e.target.checked)}
                />
                VAT
                <input
                  type="number"
                  className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-center"
                  value={jo.vatPercent}
                  onChange={e => setField('vatPercent', e.target.value)}
                  min="0"
                  max="100"
                  disabled={!jo.vatEnabled}
                />
                % (on net)
              </span>
              <span className="font-medium">AED {vatAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-bold text-base border-t border-slate-200 pt-2 mt-2">
              <span>TOTAL</span>
              <span>AED {total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>}
        </div>

        {/* Generate PDF Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={generatePDF}
            disabled={generating || !jo.subcontractor.name}
            className="btn-gradient-blue flex items-center gap-2 px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> {editingId ? 'Saving...' : 'Generating...'}</>
            ) : editingId ? (
              <><HiDownload className="w-5 h-5" /> Save Changes</>
            ) : (
              <><HiDownload className="w-5 h-5" /> Generate Job Order PDF</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HiDocumentText, HiUpload, HiPlus, HiTrash, HiDownload, HiPencil, HiX, HiRefresh, HiLocationMarker, HiClock } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';

import { API_BASE } from '../services/apiBase';

const API = `${API_BASE}/lpo-gen`;

const PREDEFINED_SITES = [
  {
    name: 'Warsan',
    site: 'WARSAN - G+2P+7 RESIDENTIAL TOWER FOR AJMAL REAL ESTATE ON PLOT NO IC3-L-03 - WARSAN 4TH - 624',
    project: 'G+2P+7 RESIDENTIAL TOWER FOR AJMAL REAL ESTATE ON PLOT NO IC3-L-03 - WARSAN 4TH - 624',
  },
  {
    name: 'Wadi Al Safa 3',
    site: 'WADI AL SAFA 3 - G+3 POD +13 FLOORS+ROOF ON PLOT NO 645-7809 WADI AL SAFA 3 FOR MR AHMAD HUSSEIN HUSSEIN ABOU EID',
    project: 'G+3 POD +13 FLOORS+ROOF ON PLOT NO 645-7809 WADI AL SAFA 3 FOR MR AHMAD HUSSEIN HUSSEIN ABOU EID',
  },
  {
    name: 'Nadd Al Shiba',
    site: 'NADD AL SHIBA - G+ 2POD. + 6+ ROOF) PLOT NO. 618-5417 AT NADD AL SHIBA FIRST HUSSEIN HASSAN ABOU EID (S#106)',
    project: 'G+ 2POD. + 6+ ROOF) PLOT NO. 618-5417 AT NADD AL SHIBA FIRST HUSSEIN HASSAN ABOU EID (S#106)',
  },
  {
    name: 'Jedaf',
    site: 'JEDAF - 4P + G+ 6 TYP + 1 R AT AL JEDAF ON PLOT NO. 3260901 FOR SHEIKH MOHAMMED SALEM SULTAN AL QASSIMI',
    project: '4P + G+ 6 TYP + 1 R AT AL JEDAF ON PLOT NO. 3260901 FOR SHEIKH MOHAMMED SALEM SULTAN AL QASSIMI',
  },
];

const today = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
};

const emptyLpo = (lpoNumber) => ({
  lpoNumber: lpoNumber || '',
  lpoDate: today(),
  quoteRef: '',
  project: '',
  site: '',
  deliveryContact: '',
  deliveryPhone: '',
  paymentTerms: '90 DAYS PDC',
  vendor: { name: '', contact: '', email: '', phone: '', address: '', trn: '' },
  lineItems: [{ description: '', quantity: 1, unit: 'Nos', unitPrice: 0, totalPrice: 0 }],
  // How the order is priced: 'unit' (Qty x rate), 'total' (a figure per line)
  // or 'lump' (one figure for the whole order). Drives both the form columns
  // and the PDF columns — see pdf_generator.generate_lpo.
  pricingMode: 'unit',
  discount: 0,
  vatPercent: 5,
  // Lump-sum override: type either the ex-VAT Subtotal or the VAT-inclusive
  // TOTAL and the rest is derived from it. null = derive from the line items.
  override: null,   // { basis: 'subtotal' | 'total', value: '15750' }
  extraTerms: [],
  notes: '',
});

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Mirrors the totals maths in pdf_generator.generate_lpo — if you change one,
// change the other, or the screen and the PDF will disagree.
function calcTotals(lineItems, vatPercent, discount, override, pricingMode) {
  // A lump-sum order has no per-line money, so its value is the override alone.
  const lineSum = pricingMode === 'lump'
    ? 0
    : lineItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
  const rate = (parseFloat(vatPercent) || 0) / 100;
  const ov = override && parseFloat(override.value);
  const active = ov > 0 ? override.basis : null;

  if (active === 'total') {
    // Worked backwards from the figure typed, like a payment certificate: the
    // bottom line is exactly what the office entered, to the cent.
    const total = round2(ov);
    const net = round2(total / (1 + rate));
    const vatAmount = round2(total - net);
    const disc = Math.max(parseFloat(discount) || 0, 0);
    return { lineSum, subtotal: round2(net + disc), discount: disc, net, vatAmount, total, basis: 'total' };
  }

  const subtotal = active === 'subtotal' ? round2(ov) : lineSum;
  const disc = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const net = subtotal - disc;
  const vatAmount = net * rate;
  return { lineSum, subtotal, discount: disc, net, vatAmount, total: net + vatAmount, basis: active };
}

// ── Site Manager Modal ────────────────────────────────────────────────────────
function SiteModal({ sites, onClose, onAdd, onDelete, onSelect }) {
  const [newName, setNewName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HiLocationMarker className="text-blue-500" /> Delivery Sites
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Add new */}
        <div className="flex gap-2 mb-4">
          <input
            className="input-field flex-1"
            placeholder="New site name..."
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

        {/* Site list */}
        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {sites.length === 0 && <li className="text-sm text-slate-400 text-center py-4">No sites yet</li>}
          {sites.map((s, i) => (
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
function LPOHistoryPanel({ onClose, onEdit }) {
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
        setError(d.error || 'Could not load LPO history');
      }
    } catch (e) {
      setError(e.message || 'Could not load LPO history');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const deleteRecord = async (record) => {
    if (!window.confirm(`Delete LPO ${record.lpo_number}? This cannot be undone.`)) return;
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
    a.download = `${record.lpo_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HiClock className="text-blue-500" /> LPO History
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="input-field sm:col-span-1"
            placeholder="Search supplier, project, LPO no..."
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
                <div className="font-mono font-bold text-sm text-slate-800">{r.lpo_number}</div>
                <div className="text-sm text-slate-600 truncate">{r.supplier_name}</div>
                <div className="text-xs text-slate-400 truncate">{r.project}</div>
                <div className="text-xs text-slate-400">{r.lpo_date}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium text-slate-700 text-sm">
                  AED {(parseFloat(r.total_amount) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
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

// ── Line Items Table ──────────────────────────────────────────────────────────
// Every cell is editable. The boxes are drawn (not borderless) because the
// transparent version read as plain text and nobody realised they could type in
// Unit / Rate / Total at all.
const CELL = 'w-full border border-slate-200 rounded bg-white px-1.5 py-1 text-sm ' +
             'focus:border-blue-400 focus:ring-1 focus:ring-blue-300 outline-none';

const PRICING_MODES = [
  { key: 'unit',  label: 'Unit price', hint: 'Type Qty and a rate per unit — the line Total is Qty x rate.' },
  { key: 'total', label: 'Line total', hint: 'Type one figure per line. No unit rate is printed.' },
  { key: 'lump',  label: 'Lump sum',   hint: 'Descriptions only. One figure for the whole order, entered under Totals.' },
];

function LineItemsTable({ items, onChange, mode }) {
  const showPrices = mode !== 'lump';
  const showRate   = mode === 'unit';

  const update = (idx, field, val) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        next.totalPrice = (parseFloat(next.quantity) || 0) * (parseFloat(next.unitPrice) || 0);
      } else if (field === 'totalPrice') {
        // The line Total is typeable too (a lump-sum service line is usually
        // quoted as one figure). Typing it back-solves the Rate so the printed
        // Qty x Rate still ties to the Total column.
        const qty = parseFloat(next.quantity) || 0;
        next.unitPrice = qty ? Math.round(((parseFloat(val) || 0) / qty) * 100) / 100 : 0;
      }
      return next;
    });
    onChange(updated);
  };

  const addRow = () => onChange([...items, { description: '', quantity: 1, unit: 'Nos', unitPrice: 0, totalPrice: 0 }]);
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="py-2 px-3 text-center w-8">#</th>
              <th className="py-2 px-3 text-left">Description</th>
              {showPrices && <th className="py-2 px-3 text-center w-20">Qty</th>}
              {showPrices && <th className="py-2 px-3 text-center w-20">Unit</th>}
              {showRate && <th className="py-2 px-3 text-right w-28">Unit Price</th>}
              {showPrices && <th className="py-2 px-3 text-right w-28">Total</th>}
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="py-1 px-3 text-center text-slate-500">{i + 1}</td>
                <td className="py-1 px-2">
                  <input
                    className={CELL}
                    value={item.description}
                    onChange={e => update(i, 'description', e.target.value)}
                    placeholder="Item description..."
                  />
                </td>
                {showPrices && (
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      className={`${CELL} text-center`}
                      value={item.quantity}
                      onChange={e => update(i, 'quantity', e.target.value)}
                      min="0"
                    />
                  </td>
                )}
                {showPrices && (
                  <td className="py-1 px-2">
                    <input
                      className={`${CELL} text-center`}
                      value={item.unit}
                      onChange={e => update(i, 'unit', e.target.value)}
                      placeholder="Nos"
                    />
                  </td>
                )}
                {showRate && (
                  <td className="py-1 px-2">
                    <input
                      type="number"
                      className={`${CELL} text-right`}
                      value={item.unitPrice}
                      onChange={e => update(i, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </td>
                )}
                {showPrices && (
                  <td className="py-1 px-2">
                    {/* In unit-price mode the Total is Qty x rate, so it is shown,
                        not typed — typing it there would fight the rate. */}
                    {showRate ? (
                      <div className="px-1.5 py-1 text-right font-medium text-slate-700">
                        {(parseFloat(item.totalPrice) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <input
                        type="number"
                        className={`${CELL} text-right font-medium`}
                        value={item.totalPrice}
                        onChange={e => update(i, 'totalPrice', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    )}
                  </td>
                )}
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
export default function LPOPage() {
  const [lpo, setLpo] = useState(null);
  const [selectedSiteKey, setSelectedSiteKey] = useState('');
  const [sites, setSites] = useState([]);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [extracted, setExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Load next number and sites on mount
  useEffect(() => {
    fetch(`${API}/next-number`).then(r => r.json()).then(d => {
      if (d.success) setLpo(emptyLpo(d.lpo_number));
    }).catch(() => setLpo(emptyLpo('LPO-2026-0001')));

    fetch(`${API}/sites`).then(r => r.json()).then(d => {
      if (d.success) setSites(d.sites);
    });
  }, []);

  const setField = (path, val) => {
    setLpo(prev => {
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

      // Fetch next LPO number
      const numRes = await fetch(`${API}/next-number`);
      const numData = await numRes.json();

      setExtracted(true);
      setLpo(prev => ({
        ...(prev || emptyLpo('')),
        lpoNumber: numData.success ? numData.lpo_number : (prev?.lpoNumber || ''),
        vendor: {
          name: d.supplier_name || '',
          contact: d.supplier_contact || '',
          email: d.supplier_email || '',
          phone: d.supplier_phone || '',
          address: d.supplier_address || '',
          trn: d.supplier_trn || '',
        },
        lineItems: (d.line_items || []).map(li => ({
          description: li.description || '',
          quantity: li.quantity || 1,
          unit: li.unit || 'Nos',
          unitPrice: li.unit_price || 0,
          totalPrice: li.total_price || 0,
        })),
        quoteRef: d.quotation_number || '',
        discount: d.discount || 0,
        vatPercent: d.vat_percent || 5,
        pricingMode: 'unit',
        override: null,   // a fresh quotation starts from its own line items
        paymentTerms: d.payment_terms || '90 DAYS PDC',
        notes: d.notes || '',
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

  const addSite = async (name) => {
    const res = await fetch(`${API}/sites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await res.json();
    if (d.success) setSites(d.sites);
  };

  const deleteSite = async (idx) => {
    const res = await fetch(`${API}/sites/${idx}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) setSites(d.sites);
  };

  const generatePDF = async () => {
    if (!lpo) return;
    setGenerating(true);
    setError(null);
    try {
      const ovValue = parseFloat(lpo.override && lpo.override.value) || 0;
      const ovBasis = ovValue > 0 ? lpo.override.basis : null;
      const payload = {
        lpo: {
          lpo_id: lpo.lpoNumber,
          lpo_date: lpo.lpoDate,
          quote_ref: lpo.quoteRef,
          project: lpo.project,
          delivery_site: lpo.site,
          delivery_contact: lpo.deliveryContact,
          delivery_phone: lpo.deliveryPhone,
          payment_terms: lpo.paymentTerms,
          vat_percent: parseFloat(lpo.vatPercent) || 5,
          discount: parseFloat(lpo.discount) || 0,
          pricing_mode: PRICING_MODES.some(m => m.key === lpo.pricingMode) ? lpo.pricingMode : 'unit',
          subtotal_override: ovBasis === 'subtotal' ? ovValue : null,
          total_override: ovBasis === 'total' ? ovValue : null,
          extra_terms: (lpo.extraTerms || []).map(t => (t || '').trim()).filter(Boolean),
          notes: lpo.notes,
        },
        supplier: {
          name: lpo.vendor.name,
          contact: lpo.vendor.contact,
          email: lpo.vendor.email,
          phone: lpo.vendor.phone,
          address: lpo.vendor.address,
          trn: lpo.vendor.trn,
        },
        line_items: lpo.lineItems.map(li => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 0,
          unit: li.unit,
          unit_price: parseFloat(li.unitPrice) || 0,
          total_price: parseFloat(li.totalPrice) || 0,
        })),
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
      a.download = `${lpo.lpoNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(dlUrl);

      if (editingId) {
        // Saved an edit to a past record — exit edit mode and return to a fresh form.
        setEditingId(null);
        const numRes = await fetch(`${API}/next-number`);
        const numData = await numRes.json();
        if (numData.success) setLpo(emptyLpo(numData.lpo_number));
      } else {
        // Load next number for next LPO
        const numRes = await fetch(`${API}/next-number`);
        const numData = await numRes.json();
        if (numData.success) setLpo(prev => ({ ...prev, lpoNumber: numData.lpo_number }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = async () => {
    const res = await fetch(`${API}/next-number`);
    const d = await res.json();
    setLpo(emptyLpo(d.success ? d.lpo_number : ''));
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
    setLpo({
      lpoNumber: r.lpo_number || '',
      lpoDate: r.lpo_date || today(),
      quoteRef: r.quote_ref || '',
      project: r.project || '',
      site: r.delivery_site || '',
      deliveryContact: r.delivery_contact || '',
      deliveryPhone: r.delivery_phone || '',
      paymentTerms: r.payment_terms == null ? '90 DAYS PDC' : r.payment_terms,
      vendor: {
        name: r.supplier_name || '', contact: r.supplier_contact || '', email: r.supplier_email || '',
        phone: r.supplier_phone || '', address: r.supplier_address || '', trn: r.supplier_trn || '',
      },
      lineItems: (r.line_items || []).map(li => ({
        description: li.description || '', quantity: li.quantity || 0, unit: li.unit || 'Nos',
        unitPrice: li.unit_price || 0, totalPrice: li.total_price || 0,
      })),
      discount: parseFloat(r.discount) || 0,
      vatPercent: r.vat_percent == null ? 5 : parseFloat(r.vat_percent),
      pricingMode: r.pricing_mode || 'unit',
      override: parseFloat(r.total_override) > 0 ? { basis: 'total', value: String(r.total_override) }
              : parseFloat(r.subtotal_override) > 0 ? { basis: 'subtotal', value: String(r.subtotal_override) }
              : null,
      extraTerms: r.extra_terms || [],
      notes: r.notes || '',
    });
    setEditingId(record.id);
    setShowHistory(false);
    setExtracted(false);
    setError(null);
  };

  if (!lpo) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  // Anything unrecognised (an older record, a hand-edited row) falls back to
  // the original Qty x Rate layout rather than blowing up the page.
  const pricingMode = PRICING_MODES.some(m => m.key === lpo.pricingMode) ? lpo.pricingMode : 'unit';
  const { lineSum, subtotal, discount, net, vatAmount, total, basis } =
    calcTotals(lpo.lineItems, lpo.vatPercent, lpo.discount, lpo.override, pricingMode);
  // A lump-sum LPO is worth nothing until the one figure is typed.
  const missingLumpSum = pricingMode === 'lump' && !(total > 0);
  // Typing in Subtotal or TOTAL sets that one as the basis and releases the
  // other — two lump sums at once would just contradict each other.
  const setOverride = (b, value) => setField('override', value === '' ? null : { basis: b, value });
  const overrideValue = (b) => (lpo.override && lpo.override.basis === b ? lpo.override.value : '');

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="LPO Generator"
        subtitle="Local Purchase Orders"
        icon={HiDocumentText}
        onAction={cancelEdit}
        actionLabel="New LPO"
        actionIcon={HiRefresh}
      />

      {showSiteModal && (
        <SiteModal
          sites={sites}
          onClose={() => setShowSiteModal(false)}
          onAdd={addSite}
          onDelete={deleteSite}
          onSelect={s => setField('site', s)}
        />
      )}

      {showHistory && (
        <LPOHistoryPanel
          onClose={() => setShowHistory(false)}
          onEdit={startEdit}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <div className="flex justify-end -mb-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 font-medium"
          >
            <HiClock className="w-4 h-4" /> History
          </button>
        </div>

        {/* Editing banner */}
        {editingId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-blue-800">
            <span>Editing <strong>{lpo.lpoNumber}</strong></span>
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
            <span>✓ Quotation extracted — now fill in <strong>Project</strong>, <strong>Delivery Site</strong>, <strong>Delivery Contact</strong> &amp; <strong>Phone</strong> before generating.</span>
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
              <p className="text-sm font-medium text-slate-600">Drop quotation here or click to upload</p>
              <p className="text-xs text-slate-400">Supports JPG, PNG, PDF — AI fills supplier info &amp; line items. You fill Project, Delivery Site &amp; Contact.</p>
            </div>
          )}
        </div>

        {/* LPO Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">LPO Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="input-label">LPO Number</label>
              <input
                className={`input-field font-mono font-bold ${editingId ? 'bg-slate-50' : ''}`}
                value={lpo.lpoNumber}
                onChange={e => setField('lpoNumber', e.target.value)}
                readOnly={!!editingId}
                title={editingId ? 'LPO Number is locked while editing — it identifies the saved record and cannot be changed.' : undefined}
              />
            </div>
            <div>
              <label className="input-label">LPO Date</label>
              <input type="date" className="input-field" value={lpo.lpoDate} onChange={e => setField('lpoDate', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Quote Ref</label>
              <input
                className="input-field"
                value={lpo.quoteRef}
                onChange={e => setField('quoteRef', e.target.value)}
                placeholder="Supplier's quotation reference..."
              />
            </div>
            <div className="sm:col-span-3">
              <label className="input-label">Project</label>
              <input
                className="input-field"
                value={lpo.project}
                onChange={e => setField('project', e.target.value)}
                placeholder="Full project description e.g. NO.S-106: (G+2 POD+6+ROOF) ON PLOT NO 618-5417..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Delivery Site</label>
              <select
                className="input-field"
                value={selectedSiteKey}
                onChange={e => {
                  const selected = PREDEFINED_SITES.find(s => s.name === e.target.value);
                  setSelectedSiteKey(e.target.value);
                  if (selected) {
                    setLpo(prev => ({ ...prev, site: selected.site, project: selected.project }));
                  }
                }}
              >
                <option value="">-- Select a site --</option>
                {PREDEFINED_SITES.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Payment Terms</label>
              <input
                className="input-field"
                value={lpo.paymentTerms}
                onChange={e => setField('paymentTerms', e.target.value)}
                placeholder="e.g. 90 DAYS PDC"
              />
            </div>
            <div>
              <label className="input-label">Delivery Contact</label>
              <input
                className="input-field"
                value={lpo.deliveryContact}
                onChange={e => setField('deliveryContact', e.target.value)}
                placeholder="e.g. Eng. HATIM"
              />
            </div>
            <div>
              <label className="input-label">Delivery Phone</label>
              <input
                className="input-field"
                value={lpo.deliveryPhone}
                onChange={e => setField('deliveryPhone', e.target.value)}
                placeholder="e.g. 0502831575"
              />
            </div>
          </div>
        </div>

        {/* Vendor Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Vendor / Supplier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Supplier Name</label>
              <input className="input-field" value={lpo.vendor.name} onChange={e => setField('vendor.name', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Contact Person</label>
              <input className="input-field" value={lpo.vendor.contact} onChange={e => setField('vendor.contact', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input className="input-field" type="email" value={lpo.vendor.email} onChange={e => setField('vendor.email', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input className="input-field" value={lpo.vendor.phone} onChange={e => setField('vendor.phone', e.target.value)} />
            </div>
            <div>
              <label className="input-label">TRN</label>
              <input className="input-field" value={lpo.vendor.trn} onChange={e => setField('vendor.trn', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Address</label>
              <input className="input-field" value={lpo.vendor.address} onChange={e => setField('vendor.address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Line Items</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Priced by</span>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                {PRICING_MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setField('pricingMode', m.key)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      pricingMode === m.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {PRICING_MODES.find(m => m.key === pricingMode).hint}
          </p>
          <LineItemsTable
            items={lpo.lineItems}
            onChange={items => setLpo(prev => ({ ...prev, lineItems: items }))}
            mode={pricingMode}
          />
        </div>

        {/* Terms & Conditions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Terms &amp; Conditions</h2>
          <p className="text-xs text-slate-400 mb-3">
            Standard points (Delivery, Contact, Payment Terms, Original tax invoice) are added automatically.
            Add any extra points below — they appear after the standard ones, numbered in order.
          </p>
          <div className="space-y-2">
            {(lpo.extraTerms || []).map((term, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-5 text-right">{i + 1}.</span>
                <input
                  className="input-field flex-1"
                  value={term}
                  onChange={e => setLpo(prev => ({
                    ...prev,
                    extraTerms: prev.extraTerms.map((t, j) => (j === i ? e.target.value : t)),
                  }))}
                  placeholder="e.g. Warranty: 12 months from handover..."
                />
                <button
                  onClick={() => setLpo(prev => ({ ...prev, extraTerms: prev.extraTerms.filter((_, j) => j !== i) }))}
                  className="text-red-400 hover:text-red-600"
                  title="Remove point"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLpo(prev => ({ ...prev, extraTerms: [...(prev.extraTerms || []), ''] }))}
            className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            <HiPlus className="w-4 h-4" /> Add Point
          </button>
        </div>

        {/* Totals + Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Notes</h2>
            <textarea
              className="input-field resize-none h-28"
              value={lpo.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Additional notes or terms..."
            />
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Totals</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-2">
                  Subtotal
                  <input
                    type="number"
                    className={`w-24 border rounded px-1 py-0.5 text-xs text-right ${basis === 'subtotal' ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                    value={overrideValue('subtotal')}
                    onChange={e => setOverride('subtotal', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="auto"
                    title="Type an ex-VAT lump sum to override the line items"
                  />
                </span>
                <span className="font-medium">AED {subtotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="flex items-center gap-2">
                  Discount (AED)
                  <input
                    type="number"
                    className="w-24 border border-slate-200 rounded px-1 py-0.5 text-xs text-right"
                    value={lpo.discount}
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
                  VAT
                  <input
                    type="number"
                    className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-center"
                    value={lpo.vatPercent}
                    onChange={e => setField('vatPercent', e.target.value)}
                    min="0"
                    max="100"
                  />
                  % (on net)
                </span>
                <span className="font-medium">AED {vatAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-slate-800 font-bold text-base border-t border-slate-200 pt-2 mt-2">
                <span className="flex items-center gap-2">
                  TOTAL
                  <input
                    type="number"
                    className={`w-28 border rounded px-1 py-0.5 text-xs text-right font-normal ${basis === 'total' ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                    value={overrideValue('total')}
                    onChange={e => setOverride('total', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="auto"
                    title="Type the final VAT-inclusive figure — Subtotal and VAT are worked backwards from it"
                  />
                </span>
                <span>AED {total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              {missingLumpSum && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
                  This is a lump-sum LPO — type the order value into Subtotal (ex-VAT)
                  or TOTAL (VAT-inclusive) above before generating the PDF.
                </div>
              )}
              {basis && !missingLumpSum && (
                <div className={`flex items-start justify-between gap-2 text-xs rounded px-2 py-1.5 mt-2 ${
                  pricingMode === 'lump'
                    ? 'text-slate-500 bg-slate-50 border border-slate-200'
                    : 'text-amber-700 bg-amber-50 border border-amber-200'
                }`}>
                  <span>
                    {basis === 'total'
                      ? 'TOTAL is fixed at the figure you typed; Subtotal and VAT are worked backwards from it.'
                      : 'Subtotal is fixed at the figure you typed.'}
                    {/* Only worth flagging a mismatch when the lines carry money
                        at all — a lump-sum order's lines never do. */}
                    {pricingMode !== 'lump' &&
                      ` Line items add up to AED ${lineSum.toLocaleString('en-AE', { minimumFractionDigits: 2 })}.`}
                  </span>
                  {pricingMode !== 'lump' && (
                    <button
                      onClick={() => setField('override', null)}
                      className="shrink-0 font-medium text-amber-800 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate PDF Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={generatePDF}
            disabled={generating || !lpo.vendor.name || missingLumpSum}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
          >
            {generating ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> {editingId ? 'Saving...' : 'Generating...'}</>
            ) : editingId ? (
              <><HiDownload className="w-5 h-5" /> Save Changes</>
            ) : (
              <><HiDownload className="w-5 h-5" /> Generate LPO PDF</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

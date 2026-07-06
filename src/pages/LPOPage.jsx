import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HiDocumentText, HiUpload, HiPlus, HiTrash, HiDownload, HiPencil, HiX, HiRefresh, HiLocationMarker } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';

const API = `${import.meta.env.VITE_API_BASE_URL || '/api'}/lpo-gen`;

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
  vatPercent: 5,
  notes: '',
});

function calcTotals(lineItems, vatPercent) {
  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
  const vatAmount = subtotal * (parseFloat(vatPercent) || 0) / 100;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
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

// ── Line Items Table ──────────────────────────────────────────────────────────
function LineItemsTable({ items, onChange }) {
  const update = (idx, field, val) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        next.totalPrice = (parseFloat(next.quantity) || 0) * (parseFloat(next.unitPrice) || 0);
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
              <th className="py-2 px-3 text-center w-20">Qty</th>
              <th className="py-2 px-3 text-center w-20">Unit</th>
              <th className="py-2 px-3 text-right w-28">Unit Price</th>
              <th className="py-2 px-3 text-right w-28">Total</th>
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
                <td className="py-1 px-2">
                  <input
                    type="number"
                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm text-center"
                    value={item.quantity}
                    onChange={e => update(i, 'quantity', e.target.value)}
                    min="0"
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 text-sm text-center"
                    value={item.unit}
                    onChange={e => update(i, 'unit', e.target.value)}
                  />
                </td>
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
                <td className="py-1 px-3 text-right font-medium text-slate-700">
                  {(parseFloat(item.totalPrice) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
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
export default function LPOPage() {
  const [lpo, setLpo] = useState(null);
  const [selectedSiteKey, setSelectedSiteKey] = useState('');
  const [sites, setSites] = useState([]);
  const [showSiteModal, setShowSiteModal] = useState(false);
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
        vatPercent: d.vat_percent || 5,
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
        notes: lpo.notes,
      };

      const res = await fetch(`${API}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PDF generation failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lpo.lpoNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Load next number for next LPO
      const numRes = await fetch(`${API}/next-number`);
      const numData = await numRes.json();
      if (numData.success) setLpo(prev => ({ ...prev, lpoNumber: numData.lpo_number }));
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

  if (!lpo) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  const { subtotal, vatAmount, total } = calcTotals(lpo.lineItems, lpo.vatPercent);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="LPO Generator"
        subtitle="Local Purchase Orders"
        icon={HiDocumentText}
        onAction={resetForm}
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

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
                className="input-field font-mono font-bold"
                value={lpo.lpoNumber}
                onChange={e => setField('lpoNumber', e.target.value)}
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
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Line Items</h2>
          <LineItemsTable
            items={lpo.lineItems}
            onChange={items => setLpo(prev => ({ ...prev, lineItems: items }))}
          />
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
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">AED {subtotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
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
                  %
                </span>
                <span className="font-medium">AED {vatAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold text-base border-t border-slate-200 pt-2 mt-2">
                <span>TOTAL</span>
                <span>AED {total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Generate PDF Button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={generatePDF}
            disabled={generating || !lpo.vendor.name}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
          >
            {generating ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generating...</>
            ) : (
              <><HiDownload className="w-5 h-5" /> Generate LPO PDF</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

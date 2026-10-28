import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HiClipboardCheck, HiUpload, HiPlus, HiTrash, HiDownload, HiX, HiRefresh,
  HiSave, HiCursorClick, HiTemplate, HiChevronDown, HiChevronRight,
} from 'react-icons/hi';
import PageHeader from '../components/PageHeader';

import { API_BASE } from '../services/apiBase';

const API = `${API_BASE}/credit-form`;

const KINDS = [
  { value: 'text', label: 'Text' },
  { value: 'checkbox', label: 'Tick (X)' },
  { value: 'multiline', label: 'Paragraph' },
];

// What to do with one of the supplier's own printed clauses.
// "Strike out" is the default amendment: the supplier can see what you
// rejected, which is how a contract change is normally made. "Delete" wipes
// the text entirely, so the clause leaves no trace on your copy.
const CLAUSE_MODES = [
  { value: 'keep', label: 'Keep', hint: 'Leave the clause as printed' },
  { value: 'strike', label: 'Strike out', hint: 'Cross it through — visible to the supplier' },
  { value: 'replace', label: 'Reword', hint: 'Delete it and write your own wording' },
  { value: 'remove', label: 'Delete', hint: 'Remove it completely, leaving blank space' },
];

// ── Placement box on the page preview ─────────────────────────────────────────
// scale converts PDF points to rendered pixels.
function Box({ p, scale, selected, onSelect, onDragStart }) {
  const style = {
    left: p.x0 * scale,
    top: p.y0 * scale,
    width: Math.max((p.x1 - p.x0) * scale, 4),
    height: Math.max((p.y1 - p.y0) * scale, 4),
  };

  const tone = !p.enabled
    ? 'border-slate-300 bg-slate-200/30 text-slate-400'
    : p.field_key
      ? 'border-emerald-500 bg-emerald-400/20 text-emerald-900'
      : 'border-amber-500 bg-amber-400/20 text-amber-900';

  return (
    <div
      className={`absolute border-2 rounded-sm cursor-move overflow-hidden ${tone} ${
        selected ? 'ring-2 ring-blue-500 z-20' : 'z-10'
      }`}
      style={style}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(p.id); onDragStart(e, p, 'move'); }}
      title={p.label || 'Unlabelled'}
    >
      <span className="block px-0.5 text-[10px] leading-tight truncate select-none pointer-events-none">
        {p.enabled ? p.text : ''}
      </span>
      {selected && (
        <span
          className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-600 rounded-sm cursor-se-resize"
          onPointerDown={(e) => { e.stopPropagation(); onDragStart(e, p, 'resize'); }}
        />
      )}
    </div>
  );
}

export default function CreditFormPage() {
  const [profile, setProfile] = useState([]);
  const [values, setValues] = useState({});
  const [doc, setDoc] = useState(null);            // {form_id, zoom, pages, placements}
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [supplierName, setSupplierName] = useState('');

  const [pageIdx, setPageIdx] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showClauses, setShowClauses] = useState(true);
  const [zoom, setZoom] = useState(1);

  const [busy, setBusy] = useState(null);          // 'analyzing' | 'generating' | 'saving'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [renderW, setRenderW] = useState(0);
  const dragRef = useRef(null);

  // ── Load profile + saved templates ─────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/profile`).then(r => r.json()).then(d => {
      if (d.success) {
        setProfile(d.profile);
        setValues(Object.fromEntries(d.profile.map(f => [f.key, f.value])));
      }
    }).catch(() => {});
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    fetch(`${API}/templates`).then(r => r.json())
      .then(d => { if (d.success) setTemplates(d.templates); })
      .catch(() => {});
  };

  // Track the rendered width so PDF points map to pixels exactly.
  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const ro = new ResizeObserver(() => setRenderW(el.clientWidth));
    ro.observe(el);
    setRenderW(el.clientWidth);
    return () => ro.disconnect();
  }, [doc, pageIdx, zoom]);

  const page = doc?.pages?.[pageIdx];
  const scale = page && renderW ? renderW / page.width : 1;

  const placements = doc?.placements || [];
  const pagePlacements = useMemo(
    () => placements.filter(p => p.page === pageIdx),
    [placements, pageIdx],
  );
  const assigned = pagePlacements.filter(p => p.enabled);
  const unassigned = pagePlacements.filter(p => !p.enabled);

  // The supplier's own printed clauses on this page, plus any amendment made.
  const editsById = useMemo(() => {
    const m = {};
    (doc?.edits || []).forEach(e => { m[e.id] = e; });
    return m;
  }, [doc]);

  const pageParagraphs = page?.paragraphs || [];
  const amendedCount = (doc?.edits || []).filter(e => e.mode && e.mode !== 'keep').length;

  const setClause = (para, changes) => {
    setDoc(d => {
      const rest = (d.edits || []).filter(e => e.id !== para.id);
      const current = (d.edits || []).find(e => e.id === para.id) || {
        id: para.id, page: para.page,
        x0: para.x0, y0: para.y0, x1: para.x1, y1: para.y1,
        text_x0: para.text_x0, size: para.size,
        mode: 'keep', text: '',
      };
      const next = { ...current, ...changes };
      // A clause left as printed carries no edit at all.
      return { ...d, edits: next.mode === 'keep' ? rest : [...rest, next] };
    });
  };

  // ── Placement mutation helpers ─────────────────────────────────────────────
  const patch = useCallback((id, changes) => {
    setDoc(d => ({
      ...d,
      placements: d.placements.map(p => (p.id === id ? { ...p, ...changes } : p)),
    }));
  }, []);

  const removePlacement = (id) => {
    setDoc(d => ({ ...d, placements: d.placements.filter(p => p.id !== id) }));
    setSelectedId(s => (s === id ? null : s));
  };

  const setFieldKey = (p, key) => {
    patch(p.id, {
      field_key: key || null,
      text: key ? (values[key] ?? '') : p.text,
      enabled: true,
    });
  };

  // Editing a profile value flows into every placement bound to that field.
  const setProfileValue = (key, val) => {
    setValues(v => ({ ...v, [key]: val }));
    setDoc(d => d && ({
      ...d,
      placements: d.placements.map(p => (p.field_key === key && p.kind !== 'checkbox'
        ? { ...p, text: val } : p)),
    }));
  };

  // ── Dragging: move / resize / draw-new ─────────────────────────────────────
  const pointToPdf = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const onDragStart = (e, p, mode) => {
    e.preventDefault();
    const start = pointToPdf(e);
    dragRef.current = { mode, id: p.id, start, orig: { ...p } };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  };

  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const cur = pointToPdf(e);
    const dx = cur.x - d.start.x;
    const dy = cur.y - d.start.y;
    const o = d.orig;

    if (d.mode === 'move') {
      patch(d.id, {
        x0: round1(o.x0 + dx), x1: round1(o.x1 + dx),
        y0: round1(o.y0 + dy), y1: round1(o.y1 + dy),
      });
    } else if (d.mode === 'resize') {
      patch(d.id, {
        x1: round1(Math.max(o.x0 + 8, o.x1 + dx)),
        y1: round1(Math.max(o.y0 + 6, o.y1 + dy)),
      });
    } else if (d.mode === 'draw') {
      patch(d.id, {
        x0: round1(Math.min(d.start.x, cur.x)), x1: round1(Math.max(d.start.x, cur.x)),
        y0: round1(Math.min(d.start.y, cur.y)), y1: round1(Math.max(d.start.y, cur.y)),
      });
    }
  };

  const onDragEnd = () => {
    const d = dragRef.current;
    if (d?.mode === 'draw') setAddMode(false);
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
  };

  const onCanvasPointerDown = (e) => {
    if (!addMode || !page) { setSelectedId(null); return; }
    e.preventDefault();
    const start = pointToPdf(e);
    const id = `new-${Date.now()}`;
    const fresh = {
      id, page: pageIdx,
      x0: round1(start.x), y0: round1(start.y),
      x1: round1(start.x + 60), y1: round1(start.y + 16),
      field_key: null, kind: 'text', text: '', size: null,
      label: 'Added manually', enabled: true,
    };
    setDoc(d => ({ ...d, placements: [...d.placements, fresh] }));
    setSelectedId(id);
    dragRef.current = { mode: 'draw', id, start, orig: fresh };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  };

  // ── Server actions ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setBusy('analyzing'); setError(null); setNotice(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/analyze`, { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not read this form');
      setDoc(json);
      setPageIdx(0);
      setSelectedId(null);
      setTemplateId('');
      setSupplierName(json.suggested_name || '');
      if (json.ai_status && json.ai_status.startsWith('unavailable')) {
        setNotice('AI mapping was unavailable, so only the fields matched by name are filled in. Assign the rest below or on the page.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, []);

  const loadTemplate = async (id) => {
    if (!id) return;
    setBusy('analyzing'); setError(null); setNotice(null);
    try {
      const res = await fetch(`${API}/templates/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not load template');
      // Re-apply current profile values so a saved template never carries a
      // stale T.L. expiry or bank detail.
      json.placements = json.placements.map(p => (
        p.field_key && p.kind !== 'checkbox' && values[p.field_key] !== undefined
          ? { ...p, text: values[p.field_key] } : p
      ));
      setDoc(json);
      setPageIdx(0);
      setSelectedId(null);
      setSupplierName(json.supplier_name || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generatePDF = async () => {
    if (!doc) return;
    setBusy('generating'); setError(null);
    try {
      const res = await fetch(`${API}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: doc.form_id,
          template_id: templateId || undefined,
          placements: doc.placements,
          edits: doc.edits || [],
          name: supplierName || 'Credit Application',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PDF generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${supplierName || 'Credit Application'} - FILLED.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const saveTemplate = async () => {
    if (!doc || !supplierName.trim()) {
      setError('Give the supplier a name before saving the template.');
      return;
    }
    setBusy('saving'); setError(null);
    try {
      const res = await fetch(`${API}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: doc.form_id,
          template_id: templateId || undefined,
          supplier_name: supplierName.trim(),
          placements: doc.placements,
          edits: doc.edits || [],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setNotice(`Saved "${supplierName.trim()}" — pick it from the dropdown next time.`);
      loadTemplates();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const deleteTemplate = async () => {
    if (!templateId) return;
    const t = templates.find(x => String(x.id) === String(templateId));
    if (!window.confirm(`Delete the saved template for "${t?.supplier_name}"? The blank form stored with it is removed too.`)) return;
    await fetch(`${API}/templates/${templateId}`, { method: 'DELETE' });
    setTemplateId('');
    loadTemplates();
  };

  const reset = () => {
    setDoc(null); setSelectedId(null); setTemplateId('');
    setSupplierName(''); setError(null); setNotice(null); setAddMode(false);
  };

  const groups = useMemo(() => {
    const g = {};
    profile.forEach(f => { (g[f.group] = g[f.group] || []).push(f); });
    return g;
  }, [profile]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Credit Application"
        subtitle="Supplier credit forms, filled automatically"
        icon={HiClipboardCheck}
        onAction={reset}
        actionLabel="New Form"
        actionIcon={HiRefresh}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)}><HiX className="w-4 h-4" /></button>
          </div>
        )}
        {notice && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-amber-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)}><HiX className="w-4 h-4" /></button>
          </div>
        )}

        {/* Saved suppliers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="input-label flex items-center gap-1">
                <HiTemplate className="w-4 h-4 text-slate-400" /> Saved supplier forms
              </label>
              <select
                className="input-field"
                value={templateId}
                onChange={e => { setTemplateId(e.target.value); loadTemplate(e.target.value); }}
              >
                <option value="">— Select a saved supplier —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.supplier_name}</option>
                ))}
              </select>
            </div>
            {templateId && (
              <button className="px-3 py-2 text-sm text-red-500 hover:text-red-700" onClick={deleteTemplate}>
                <HiTrash className="w-4 h-4" />
              </button>
            )}
            <div className="text-xs text-slate-400 pb-2">
              {templates.length === 0 ? 'No templates yet — upload a form and save it once it looks right.' : ''}
            </div>
          </div>
        </div>

        {/* Upload */}
        {!doc && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'
            } ${busy ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !busy && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={e => handleFile(e.target.files[0])}
            />
            {busy === 'analyzing' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="text-sm text-slate-500">Reading the form and working out where everything goes...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <HiUpload className="w-10 h-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">Drop a supplier's blank credit form here, or click to upload</p>
                <p className="text-xs text-slate-400">
                  PDF only. Every blank is found and filled with our company details — you then correct anything wrong before generating.
                </p>
              </div>
            )}
          </div>
        )}

        {doc && (
          <>
            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="input-label">Supplier name</label>
                  <input
                    className="input-field"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="e.g. UB Emirates LLC"
                  />
                </div>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border ${
                    addMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() => setAddMode(a => !a)}
                >
                  <HiCursorClick className="w-4 h-4" />
                  {addMode ? 'Now drag on the page' : 'Add a field'}
                </button>
                <button
                  className="btn-gradient-purple flex items-center gap-2"
                  onClick={saveTemplate}
                  disabled={busy === 'saving'}
                >
                  <HiSave className="w-4 h-4" />
                  {busy === 'saving' ? 'Saving...' : 'Save as template'}
                </button>
                <button
                  className="btn-gradient-blue flex items-center gap-2"
                  onClick={generatePDF}
                  disabled={busy === 'generating'}
                >
                  <HiDownload className="w-4 h-4" />
                  {busy === 'generating' ? 'Generating...' : 'Generate PDF'}
                </button>
              </div>
            </div>

            {/* Company profile */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <button
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wide"
                onClick={() => setShowProfile(s => !s)}
              >
                <span>Our company details</span>
                {showProfile ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
              </button>
              {showProfile && (
                <div className="px-5 pb-5 space-y-5">
                  <p className="text-xs text-slate-400">
                    Edit anything here and every box using it updates. Changes apply to this form only.
                  </p>
                  {Object.entries(groups).map(([group, fields]) => (
                    <div key={group}>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{group}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {fields.map(f => (
                          <div key={f.key}>
                            <label className="input-label">{f.label}</label>
                            <input
                              className="input-field"
                              value={values[f.key] ?? ''}
                              onChange={e => setProfileValue(f.key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* Preview */}
              <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div className="flex gap-1">
                    {doc.pages.map(p => (
                      <button
                        key={p.index}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          p.index === pageIdx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        onClick={() => { setPageIdx(p.index); setSelectedId(null); }}
                      >
                        {p.index + 1}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Zoom
                    <input
                      type="range" min="1" max="2.5" step="0.1"
                      value={zoom}
                      onChange={e => setZoom(parseFloat(e.target.value))}
                    />
                  </label>
                </div>

                <div className="overflow-auto max-h-[80vh] rounded-lg border border-slate-200 bg-slate-100">
                  <div style={{ width: `${zoom * 100}%` }}>
                    <div
                      ref={canvasRef}
                      className={`relative select-none ${addMode ? 'cursor-crosshair' : ''}`}
                      onPointerDown={onCanvasPointerDown}
                    >
                      <img src={page.image} alt={`Page ${pageIdx + 1}`} className="w-full block" draggable={false} />

                      {/* Amended clauses — only the ones actually changed are
                          marked, so an untouched page stays clean. */}
                      {pageParagraphs.map(para => {
                        const e = editsById[para.id];
                        if (!e || e.mode === 'keep') return null;
                        const tone = e.mode === 'remove'
                          ? 'border-red-500 bg-red-500/15'
                          : e.mode === 'replace'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-red-400 bg-red-400/10';
                        return (
                          <div
                            key={`c${para.id}`}
                            className={`absolute border-2 rounded-sm pointer-events-none ${tone}`}
                            style={{
                              left: para.x0 * scale, top: para.y0 * scale,
                              width: (para.x1 - para.x0) * scale,
                              height: (para.y1 - para.y0) * scale,
                            }}
                          >
                            {e.mode === 'strike' && (
                              <span className="absolute inset-x-1 top-1/2 h-px bg-red-500" />
                            )}
                          </div>
                        );
                      })}

                      {pagePlacements.map(p => (
                        <Box
                          key={p.id}
                          p={p}
                          scale={scale}
                          selected={selectedId === p.id}
                          onSelect={setSelectedId}
                          onDragStart={onDragStart}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  Green = filled, amber = added but not linked to a saved detail, grey = switched off.
                  Drag a box to move it, drag its blue corner to resize.
                </p>
              </div>

              {/* Field list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Filled on page {pageIdx + 1} ({assigned.length})
                  </h3>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {assigned.length === 0 && (
                      <p className="text-sm text-slate-400 py-4 text-center">
                        Nothing filled on this page yet.
                      </p>
                    )}
                    {assigned.map(p => (
                      <PlacementRow
                        key={p.id}
                        p={p}
                        profile={profile}
                        selected={selectedId === p.id}
                        onSelect={() => setSelectedId(p.id)}
                        onPatch={patch}
                        onFieldKey={setFieldKey}
                        onRemove={removePlacement}
                      />
                    ))}
                  </div>
                </div>

                {/* The supplier's own printed clauses */}
                {pageParagraphs.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wide"
                      onClick={() => setShowClauses(s => !s)}
                    >
                      <span>
                        Their printed terms ({pageParagraphs.length})
                        {amendedCount > 0 && (
                          <span className="ml-2 normal-case text-xs font-normal text-red-500">
                            {amendedCount} amended
                          </span>
                        )}
                      </span>
                      {showClauses ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
                    </button>
                    {showClauses && (
                      <div className="px-4 pb-4 space-y-2 max-h-[60vh] overflow-y-auto">
                        <p className="text-xs text-slate-400">
                          Clauses printed on this page. Striking a clause out leaves it visible with a
                          line through it, which is how the supplier sees what you did not accept.
                        </p>
                        {pageParagraphs.map(para => (
                          <ClauseRow
                            key={para.id}
                            para={para}
                            edit={editsById[para.id]}
                            onChange={changes => setClause(para, changes)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wide"
                    onClick={() => setShowUnassigned(s => !s)}
                  >
                    <span>Blanks left empty ({unassigned.length})</span>
                    {showUnassigned ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
                  </button>
                  {showUnassigned && (
                    <div className="px-4 pb-4 space-y-2 max-h-[50vh] overflow-y-auto">
                      <p className="text-xs text-slate-400">
                        Blanks found on the form that nothing was put into. Tick one to fill it.
                      </p>
                      {unassigned.map(p => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer ${
                            selectedId === p.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                          onClick={() => setSelectedId(p.id)}
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => patch(p.id, { enabled: true })}
                          />
                          <span className="text-xs text-slate-500 truncate flex-1" title={p.label}>
                            {p.label || <em className="text-slate-300">no label</em>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ── One of the supplier's printed clauses ─────────────────────────────────────
function ClauseRow({ para, edit, onChange }) {
  const mode = edit?.mode || 'keep';
  const changed = mode !== 'keep';

  return (
    <div className={`rounded-lg border p-2 ${changed ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}>
      <p className={`text-xs leading-snug ${
        mode === 'strike' ? 'line-through text-slate-400'
          : mode === 'remove' ? 'text-slate-300 italic'
          : 'text-slate-600'
      }`}>
        {para.text.length > 260 ? `${para.text.slice(0, 260)}...` : para.text}
      </p>

      <div className="flex flex-wrap gap-1 mt-2">
        {CLAUSE_MODES.map(m => (
          <button
            key={m.value}
            title={m.hint}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
              mode === m.value
                ? (m.value === 'keep'
                    ? 'bg-slate-600 text-white border-slate-600'
                    : 'bg-red-500 text-white border-red-500')
                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => onChange({ mode: m.value })}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'replace' && (
        <textarea
          className="input-field mt-2 text-xs"
          rows={3}
          value={edit?.text || ''}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="Your replacement wording for this clause..."
        />
      )}
    </div>
  );
}

// ── One editable placement ────────────────────────────────────────────────────
function PlacementRow({ p, profile, selected, onSelect, onPatch, onFieldKey, onRemove }) {
  return (
    <div
      className={`rounded-lg border p-2 ${selected ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={p.enabled}
          onChange={e => onPatch(p.id, { enabled: e.target.checked })}
          title="Include in the PDF"
        />
        <select
          className="input-field py-1 text-xs flex-1"
          value={p.field_key || ''}
          onChange={e => onFieldKey(p, e.target.value)}
        >
          <option value="">— Custom text —</option>
          {profile.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <button className="text-red-400 hover:text-red-600" onClick={() => onRemove(p.id)} title="Remove">
          <HiTrash className="w-4 h-4" />
        </button>
      </div>

      {p.kind === 'checkbox' ? (
        <p className="text-xs text-slate-400 mt-1 pl-6">Ticks this box with an X</p>
      ) : p.kind === 'multiline' ? (
        <textarea
          className="input-field mt-1 text-xs"
          rows={3}
          value={p.text}
          onChange={e => onPatch(p.id, { text: e.target.value })}
          placeholder="Paragraph text — wraps inside the box"
        />
      ) : (
        <input
          className="input-field mt-1 text-xs"
          value={p.text}
          onChange={e => onPatch(p.id, { text: e.target.value })}
          placeholder="Value to write"
        />
      )}

      {selected && (
        <div className="flex items-center gap-2 mt-2 pl-6">
          <select
            className="input-field py-1 text-xs w-28"
            value={p.kind}
            onChange={e => onPatch(p.id, {
              kind: e.target.value,
              text: e.target.value === 'checkbox' ? 'X' : p.text,
            })}
          >
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input
            type="number"
            className="input-field py-1 text-xs w-20"
            value={p.size ?? ''}
            min="5" max="20" step="0.5"
            placeholder="auto"
            onChange={e => onPatch(p.id, { size: e.target.value ? parseFloat(e.target.value) : null })}
            title="Font size — blank means fit automatically"
          />
          <span className="text-[10px] text-slate-400 truncate" title={p.label}>{p.label}</span>
        </div>
      )}
    </div>
  );
}

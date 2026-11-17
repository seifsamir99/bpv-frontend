import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOfficeBuilding, HiDownload, HiTrash, HiPlus, HiX, HiPencil, HiExclamation,
  HiChevronDown, HiChevronRight, HiCheck, HiReply,
} from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import { useProjects } from '../hooks/useProjects';

// /projects: one site's balance sheet. Money in = what the client certified,
// was invoiced and paid; money out = BPV payments the user confirmed belong to
// the site. LPOs and job orders are commitments, shown but never added to
// spend (the BPV that pays an LPO is the same money). All figures come from
// project_service; this page does no money arithmetic of its own.

const money = (v) =>
  Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const dmy = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : iso || '');

const EMPTY_PROJECT = {
  code: '', name: '', client: '', client_trn: '', invoice_title: '', contract_value: '',
  advance_recovery_pct: 10, retention_pct: 10, vat_pct: 5, match_terms: '',
};

const SOURCE_LABEL = { bpv: 'Payment', lpo: 'LPO', job_order: 'Job order' };

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>;
}

function Row({ label, value, strong, tone, hint }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">
        {label}
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`tabular-nums ${strong ? 'font-bold text-base' : 'text-sm font-medium'} ${color}`}>
        {money(value)}
      </span>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} my-8`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><HiX className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ErrorLine({ text }) {
  if (!text) return null;
  return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{text}</p>;
}

// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const p = useProjects();
  const { projects, selectedId, setSelectedId, overview, loading, error } = p;
  const [tab, setTab] = useState('invoices');
  const [modal, setModal] = useState(null); // 'project-new' | 'project-edit' | 'invoice' | 'receipt'
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const s = overview?.summary;
  const project = overview?.project;
  const costs = overview?.costs;

  const run = async (fn) => {
    setBusy(true);
    setActionError('');
    try { await fn(); } catch (e) { setActionError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Projects"
        subtitle="Site balance sheet: contract, money in, money out"
        icon={HiOfficeBuilding}
        onAction={() => setModal('project-new')}
        actionLabel="Add Project"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {error && <ErrorLine text={error} />}

        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="input-field max-w-md"
            >
              {projects.map((x) => (
                <option key={x.id} value={x.id}>{x.code} – {x.name} ({x.client})</option>
              ))}
            </select>
            {project && (
              <button onClick={() => setModal('project-edit')} className="btn-gradient-purple flex items-center gap-2">
                <HiPencil className="w-4 h-4" /> Edit project
              </button>
            )}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <Card className="p-12 text-center">
            <HiOfficeBuilding className="w-12 h-12 mx-auto text-slate-300" />
            <p className="mt-3 text-slate-600">No projects yet.</p>
          </Card>
        )}

        {s && project && (
          <>
            <Summary s={s} project={project} />

            <div className="flex gap-1 border-b border-slate-200">
              {[
                ['invoices', 'Invoices & payments'],
                ['costs', 'Costs'],
                ['review', `To review${s.to_review ? ` (${s.to_review})` : ''}`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                    tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <ErrorLine text={actionError} />

            {tab === 'invoices' && (
              <InvoicesTab
                overview={overview}
                busy={busy}
                onNewInvoice={() => setModal('invoice')}
                onNewReceipt={() => setModal('receipt')}
                onStatement={() => run(p.downloadStatementPdf)}
                onPdf={(inv) => run(() => p.downloadInvoicePdf(inv))}
                onDeleteInvoice={(inv) => {
                  if (window.confirm(`Delete Tax Invoice ${inv.invoice_no}? Payments recorded against it stay, unlinked.`)) {
                    run(() => p.deleteInvoice(inv.id));
                  }
                }}
                onDeleteReceipt={(r) => {
                  if (window.confirm(`Delete the payment of AED ${money(r.amount)}${r.cheque_no ? ` (cheque ${r.cheque_no})` : ''}?`)) {
                    run(() => p.deleteReceipt(r.id));
                  }
                }}
              />
            )}
            {tab === 'costs' && (
              <CostsTab costs={costs} s={s} busy={busy} onDecide={(items) => run(() => p.decide(items))} />
            )}
            {tab === 'review' && (
              <ReviewTab costs={costs} code={project.code} busy={busy} onDecide={(items) => run(() => p.decide(items))} />
            )}
          </>
        )}
      </main>

      {(modal === 'project-new' || modal === 'project-edit') && (
        <ProjectModal
          initial={modal === 'project-edit' ? project : null}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal === 'project-edit') await p.updateProject(data);
            else await p.createProject(data);
            setModal(null);
          }}
        />
      )}
      {modal === 'invoice' && project && (
        <InvoiceModal
          project={project}
          preview={p.previewInvoice}
          onClose={() => setModal(null)}
          onSave={async (data) => { await p.saveInvoice(data); setModal(null); }}
        />
      )}
      {modal === 'receipt' && overview && (
        <ReceiptModal
          invoices={overview.invoices}
          onClose={() => setModal(null)}
          onSave={async (data) => { await p.addReceipt(data); setModal(null); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Summary({ s, project }) {
  const pct = Math.min(100, Number(s.certified_pct || 0));
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Contract value (ex VAT)</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">AED {money(s.contract_value)}</p>
          <p className="text-sm text-slate-500">{project.client}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-600">
            Certified to date <span className="font-semibold tabular-nums">{money(s.certified_to_date)}</span>
            {' '}({Number(s.certified_pct || 0).toFixed(2)}%)
          </p>
          <p className="text-xs text-slate-400">Left to certify {money(s.balance_of_contract)}</p>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-5">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-1">Money in</h3>
          <Row label="Invoiced to client" value={s.invoiced} />
          <Row label="Received from client" value={s.received} strong />
          <Row label="Owed by client now" value={s.owed_by_client} tone={s.owed_by_client > 0 ? 'bad' : undefined} />
          <Row label="Retention held by client" value={s.retention_held} hint="Released per contract terms" />
          <Row label="Advance still to be recovered" value={s.advance_left}
               hint={`Advance ${money(s.advance_ex_vat)} less ${money(s.advance_recovered)} recovered so far`} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-1">Money out</h3>
          <Row label="Paid out on site" value={s.paid_out} strong hint="Confirmed BPV payments" />
          <Row label="LPOs ordered" value={s.lpo_ordered} hint={`${money(s.lpo_unpaid)} of it has no payment found yet`} />
          <Row label="Job orders ordered" value={s.job_orders_ordered} />
          <Row label="Security cheques held by client" value={s.security_held} hint="Not a cost, comes back at the end" />
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">Cash position (received − paid out)</p>
          <p className="text-xs text-slate-500">
            Both sides include VAT.{s.to_review > 0 && ` ${s.to_review} possible costs still to review, so spend may be understated.`}
          </p>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${s.cash_position >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          AED {money(s.cash_position)}
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function InvoicesTab({ overview, busy, onNewInvoice, onNewReceipt, onStatement, onPdf, onDeleteInvoice, onDeleteReceipt }) {
  const [open, setOpen] = useState({});
  const invoices = overview.invoices;
  const latestNo = Math.max(0, ...invoices.map((i) => Number(i.invoice_no)));

  return (
    <Card>
      <div className="flex flex-wrap gap-2 p-4 border-b border-slate-200">
        <button onClick={onNewInvoice} className="btn-gradient-blue flex items-center gap-2">
          <HiPlus className="w-4 h-4" /> New invoice from client PC
        </button>
        <button onClick={onNewReceipt} className="btn-gradient-purple flex items-center gap-2">
          <HiPlus className="w-4 h-4" /> Record payment received
        </button>
        <button onClick={onStatement} disabled={busy}
                className="ml-auto px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50">
          <HiDownload className="w-4 h-4" /> Statement / claim letter
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-6" />
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Client cert.</th>
              <th className="px-3 py-2 text-right">Cumulative work</th>
              <th className="px-3 py-2 text-right">Invoiced</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <React.Fragment key={inv.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <button onClick={() => setOpen((o) => ({ ...o, [inv.id]: !o[inv.id] }))} className="text-slate-400">
                      {open[inv.id] ? <HiChevronDown /> : <HiChevronRight />}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {inv.invoice_no}
                    {inv.note && <HiExclamation title={inv.note} className="inline w-4 h-4 ml-1 text-amber-500" />}
                  </td>
                  <td className="px-3 py-2">{dmy(inv.invoice_date)}</td>
                  <td className="px-3 py-2">{inv.client_pc || inv.kind}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {inv.kind === 'advance' ? '—' : `${money(inv.cumulative_work)} (${inv.cumulative_pct.toFixed(2)}%)`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(inv.payable)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(inv.received)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${inv.balance > 0.005 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {money(inv.balance)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => onPdf(inv)} disabled={busy} title="Download PDF"
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><HiDownload className="w-4 h-4" /></button>
                    {Number(inv.invoice_no) === latestNo && (
                      <button onClick={() => onDeleteInvoice(inv)} disabled={busy} title="Delete (latest only)"
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"><HiTrash className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
                {open[inv.id] && (
                  <tr className="bg-slate-50/60">
                    <td />
                    <td colSpan={8} className="px-3 py-2">
                      {inv.note && <p className="text-xs text-amber-700 mb-1">{inv.note}</p>}
                      {inv.kind !== 'advance' && (
                        <p className="text-xs text-slate-500 mb-2">
                          This period {money(inv.current_work)} · advance recovery {money(inv.advance_recovery)} ·
                          retention {money(inv.retention)} · previous certified {money(inv.prev_certified)} ·
                          ex VAT {money(inv.total_ex_vat)} + VAT {money(inv.vat)}
                        </p>
                      )}
                      {inv.receipts.length === 0 && <p className="text-xs text-slate-400">No payments recorded.</p>}
                      {inv.receipts.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 text-xs py-0.5">
                          <span className="w-24">{dmy(r.receipt_date)}</span>
                          <span className="w-28">{r.cheque_no ? `Chq ${r.cheque_no}` : 'Payment'}</span>
                          <span className="w-28 text-right tabular-nums font-medium">{money(r.amount)}</span>
                          <span className="text-slate-400">{[r.bank, r.note].filter(Boolean).join(' · ')}</span>
                          <button onClick={() => onDeleteReceipt(r)} className="ml-auto text-red-400 hover:text-red-600">
                            <HiTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {overview.unallocated_receipts.map((r) => (
              <tr key={`u${r.id}`} className="border-t border-slate-100 text-slate-500">
                <td />
                <td className="px-3 py-2" colSpan={2}>On account · {dmy(r.receipt_date)}</td>
                <td className="px-3 py-2">{r.cheque_no ? `Chq ${r.cheque_no}` : ''}</td>
                <td />
                <td />
                <td className="px-3 py-2 text-right tabular-nums">{money(r.amount)}</td>
                <td />
                <td className="px-3 py-2 text-right">
                  <button onClick={() => onDeleteReceipt(r)} className="p-1.5 text-red-400 hover:text-red-600"><HiTrash className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function CostRow({ item, actions }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 whitespace-nowrap">{dmy(item.date) || '—'}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-700">{item.company}</div>
        <div className="text-xs text-slate-500 whitespace-pre-line line-clamp-2">
          {item.source === 'bpv' ? `BPV ${item.bpv_no}${item.cheque_no ? ` · Chq ${item.cheque_no}` : ''} · ${item.description}`
            : item.source === 'lpo' ? item.lpo_number : `${item.ref_number}${item.scope ? ` · ${item.scope}` : ''}`}
        </div>
        {item.reason && <div className="text-xs text-blue-600 mt-0.5">{item.reason}</div>}
        {(item.warnings || []).map((w) => (
          <div key={w} className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><HiExclamation className="w-3.5 h-3.5" />{w}</div>
        ))}
      </td>
      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{money(item.amount)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{actions}</td>
    </tr>
  );
}

function CostTable({ title, items, total, note, renderActions, collapsed: startCollapsed }) {
  const [collapsed, setCollapsed] = useState(!!startCollapsed);
  return (
    <Card>
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-slate-700">
          {collapsed ? <HiChevronRight /> : <HiChevronDown />} {title}
          <span className="text-xs font-normal text-slate-400">({items.length})</span>
        </span>
        <span className="tabular-nums font-semibold">{money(total)}</span>
      </button>
      {note && !collapsed && <p className="px-4 -mt-1 pb-2 text-xs text-slate-500">{note}</p>}
      {!collapsed && items.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm"><tbody>
            {items.map((it) => <CostRow key={`${it.source}:${it.key}`} item={it} actions={renderActions(it)} />)}
          </tbody></table>
        </div>
      )}
    </Card>
  );
}

const sum = (items) => items.reduce((a, x) => a + Number(x.amount || 0), 0);

function CostsTab({ costs, busy, onDecide }) {
  const undo = (it) => (
    it.reason?.startsWith('Tagged') ? <span className="text-xs text-slate-400">tagged on BPV</span> : (
      <button disabled={busy} onClick={() => onDecide([{ source: it.source, key: it.key, status: '' }])}
              className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
        <HiReply className="w-3.5 h-3.5" /> Back to review
      </button>
    )
  );
  const lpoActions = (it) => (
    <span className="inline-flex items-center gap-3">
      <span className={`text-xs px-2 py-0.5 rounded-full ${it.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {it.paid ? 'payment found' : 'no payment yet'}
      </span>
      {undo(it)}
    </span>
  );
  return (
    <div className="space-y-4">
      <CostTable title="Payments made for this site" items={costs.bpv.included} total={sum(costs.bpv.included)}
                 note="This is the spend. Cash actually paid by BPV, including VAT." renderActions={undo} />
      <CostTable title="LPOs ordered" items={costs.lpo.included} total={sum(costs.lpo.included)}
                 note="Commitments, not added to spend. An LPO shows 'payment found' once a confirmed payment mentions its number."
                 renderActions={lpoActions} />
      <CostTable title="Job orders" items={costs.job_order.included} total={sum(costs.job_order.included)}
                 note="Commitments, not added to spend." renderActions={undo} />
      <CostTable title="Security cheques held by client" items={costs.bpv.security} total={sum(costs.bpv.security)}
                 note="Not a cost. These come back when the job is closed." renderActions={undo} />
      <CostTable title="Excluded" items={[...costs.bpv.excluded, ...costs.lpo.excluded, ...costs.job_order.excluded]}
                 total={sum([...costs.bpv.excluded, ...costs.lpo.excluded, ...costs.job_order.excluded])}
                 note="Matched a search word but you said it isn't this site's." renderActions={undo} collapsed />
    </div>
  );
}

function ReviewTab({ costs, code, busy, onDecide }) {
  const [filter, setFilter] = useState('all');
  const items = costs.review.filter((x) => filter === 'all' || x.source === filter);
  const bulk = (source) => {
    const list = costs.review.filter((x) => x.source === source);
    if (list.length && window.confirm(`Include all ${list.length} ${SOURCE_LABEL[source]}s on ${code}?`)) {
      onDecide(list.map((x) => ({ source, key: x.key, status: 'included' })));
    }
  };
  if (costs.review.length === 0) {
    return <Card className="p-10 text-center text-slate-500"><HiCheck className="w-8 h-8 mx-auto text-emerald-500" />Nothing to review.</Card>;
  }
  const btn = 'px-2 py-1 rounded text-xs font-medium disabled:opacity-50';
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-200">
        <span className="text-sm text-slate-600 mr-2">
          These matched the project's search words. Decide each once; your choice is remembered.
        </span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field w-auto text-sm">
          <option value="all">All ({costs.review.length})</option>
          {['bpv', 'lpo', 'job_order'].map((src) => (
            <option key={src} value={src}>{SOURCE_LABEL[src]}s ({costs.review.filter((x) => x.source === src).length})</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button disabled={busy} onClick={() => bulk('lpo')} className="btn-gradient-blue text-sm">Include all LPOs</button>
          <button disabled={busy} onClick={() => bulk('job_order')} className="btn-gradient-blue text-sm">Include all job orders</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map((it) => (
              <CostRow key={`${it.source}:${it.key}`} item={it} actions={
                <span className="inline-flex gap-1">
                  <span className="text-xs text-slate-400 self-center mr-1">{SOURCE_LABEL[it.source]}</span>
                  <button disabled={busy} className={`${btn} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}
                          onClick={() => onDecide([{ source: it.source, key: it.key, status: 'included' }])}>Include</button>
                  <button disabled={busy} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
                          onClick={() => onDecide([{ source: it.source, key: it.key, status: 'excluded' }])}>Exclude</button>
                  {it.source === 'bpv' && (
                    <button disabled={busy} className={`${btn} bg-amber-100 text-amber-800 hover:bg-amber-200`}
                            onClick={() => onDecide([{ source: it.source, key: it.key, status: 'security' }])}>Security</button>
                  )}
                </span>
              } />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ProjectModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(() => (initial
    ? { ...initial, match_terms: (initial.match_terms || []).join(', ') }
    : EMPTY_PROJECT));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const field = (k, label, props = {}) => (
    <div>
      <label className="input-label">{label}</label>
      <input value={form[k] ?? ''} onChange={set(k)} className="input-field" {...props} />
    </div>
  );
  return (
    <Modal title={initial ? `Edit ${initial.code}` : 'Add project'} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        {field('code', 'Site code', { placeholder: 'S108' })}
        {field('name', 'Short name', { placeholder: 'Warsan G+2P+7' })}
        {field('client', 'Client (main contractor)', { placeholder: 'M/S Sumer Contracting Co. LLC' })}
        {field('client_trn', 'Client TRN')}
        <div className="sm:col-span-2">{field('invoice_title', 'Project line printed on invoices')}</div>
        {field('contract_value', 'Contract value (ex VAT)', { type: 'number', step: '0.01' })}
        {field('vat_pct', 'VAT %', { type: 'number', step: '0.01' })}
        {field('advance_recovery_pct', 'Advance recovery % (per certificate)', { type: 'number', step: '0.01' })}
        {field('retention_pct', 'Retention %', { type: 'number', step: '0.01' })}
        <div className="sm:col-span-2">
          {field('match_terms', 'Search words for costs (comma separated)', { placeholder: '108, warsan, ajmal' })}
          <p className="text-xs text-slate-500 mt-1">
            Payments, LPOs and job orders mentioning any of these are suggested in "To review". Numbers only match on
            their own (108 won't match cheque 1081).
          </p>
        </div>
      </div>
      <ErrorLine text={err} />
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
        <button disabled={saving} className="btn-gradient-blue disabled:opacity-50" onClick={async () => {
          setSaving(true); setErr('');
          try { await onSave(form); } catch (e) { setErr(e.message); } finally { setSaving(false); }
        }}>Save</button>
      </div>
    </Modal>
  );
}

function InvoiceModal({ project, preview, onClose, onSave }) {
  const [form, setForm] = useState({
    kind: 'interim', invoice_date: today(), client_pc: '', cumulative_work: '', amount_ex_vat: '', note: '',
  });
  const [pv, setPv] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const amountKey = form.kind === 'advance' ? 'amount_ex_vat' : 'cumulative_work';

  // Live figures straight from the server, so the maths exists in one place.
  useEffect(() => {
    if (!form[amountKey]) { setPv(null); setErr(''); return undefined; }
    const t = setTimeout(async () => {
      try { setPv(await preview(form)); setErr(''); } catch (e) { setPv(null); setErr(e.message); }
    }, 350);
    return () => clearTimeout(t);
  }, [form.kind, form[amountKey]]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(() => (pv ? (form.kind === 'advance' ? [
    ['Advance (ex VAT)', pv.total_ex_vat], [`VAT ${project.vat_pct}%`, pv.vat], ['Payable with VAT', pv.payable, true],
  ] : [
    ['Previous work done', pv.prev_work, false, `${pv.prev_pct.toFixed(2)}%`],
    ['Current work done', pv.current_work, false, `${pv.current_pct.toFixed(2)}%`],
    ['Cumulative work done', pv.cumulative_work, false, `${pv.cumulative_pct.toFixed(2)}%`],
    [`Less advance recovery (${project.advance_recovery_pct}%)`, -pv.advance_recovery],
    [`Less retention (${project.retention_pct}%)`, -pv.retention],
    ['Previous certified paid amount', -pv.prev_certified],
    ['Total amount', pv.total_ex_vat],
    [`VAT (${project.vat_pct}%)`, pv.vat],
    ['Payable amount with VAT', pv.payable, true],
  ]) : []), [pv, form.kind, project]);

  return (
    <Modal title={`New tax invoice${pv ? ` ${pv.invoice_no}` : ''} — ${project.code}`} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="input-label">Type</label>
          <select value={form.kind} onChange={set('kind')} className="input-field">
            <option value="interim">Interim (against client PC)</option>
            <option value="final">Final</option>
            <option value="advance">Advance payment</option>
          </select>
        </div>
        <div>
          <label className="input-label">Invoice date</label>
          <input type="date" value={form.invoice_date} onChange={set('invoice_date')} className="input-field" />
        </div>
        {form.kind === 'advance' ? (
          <div className="sm:col-span-2">
            <label className="input-label">Advance amount (ex VAT)</label>
            <input type="number" step="0.01" value={form.amount_ex_vat} onChange={set('amount_ex_vat')} className="input-field" />
          </div>
        ) : (
          <>
            <div>
              <label className="input-label">Client certificate no.</label>
              <input value={form.client_pc} onChange={set('client_pc')} placeholder="PC4" className="input-field" />
            </div>
            <div>
              <label className="input-label">Cumulative work certified to date</label>
              <input type="number" step="0.01" value={form.cumulative_work} onChange={set('cumulative_work')}
                     placeholder="from the client's PC" className="input-field" />
            </div>
          </>
        )}
      </div>
      {form.kind !== 'advance' && (
        <p className="text-xs text-slate-500 mt-2">
          Type the client's <b>cumulative</b> "total work done" figure from their certificate, not this month's.
          Compare the payable below with the client's net amount before saving.
        </p>
      )}

      {pv && (
        <div className="mt-4 rounded-lg border border-slate-200 divide-y divide-slate-100">
          {lines.map(([label, v, strong, extra]) => (
            <div key={label} className={`flex justify-between px-3 py-1.5 text-sm ${strong ? 'font-bold bg-slate-50' : ''}`}>
              <span>{label}{extra && <span className="text-slate-400 ml-2">{extra}</span>}</span>
              <span className="tabular-nums">{v < 0 ? `(${money(-v)})` : money(v)}</span>
            </div>
          ))}
          <p className="px-3 py-1.5 text-xs text-slate-500">{pv.amount_in_words}</p>
        </div>
      )}
      {pv?.over_contract && (
        <p className="text-sm text-amber-700 mt-2">This goes over the contract value. Saving will ask you to confirm.</p>
      )}
      <ErrorLine text={err} />
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
        <button disabled={!pv || saving} className="btn-gradient-blue disabled:opacity-50" onClick={async () => {
          const data = { ...form };
          if (pv.over_contract) {
            if (!window.confirm('Cumulative work is over the contract value. Issue anyway (variation)?')) return;
            data.allow_overrun = true;
          }
          setSaving(true); setErr('');
          try { await onSave(data); } catch (e) { setErr(e.message); } finally { setSaving(false); }
        }}>Issue invoice</button>
      </div>
    </Modal>
  );
}

function ReceiptModal({ invoices, onClose, onSave }) {
  const open = invoices.filter((i) => i.balance > 0.005);
  const [form, setForm] = useState({
    receipt_date: today(), amount: '', cheque_no: '', bank: '', note: '',
    invoice_id: open.length ? open[0].id : '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Record payment received" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Date received</label>
          <input type="date" value={form.receipt_date} onChange={set('receipt_date')} className="input-field" />
        </div>
        <div>
          <label className="input-label">Amount (AED)</label>
          <input type="number" step="0.01" value={form.amount} onChange={set('amount')} className="input-field" />
        </div>
        <div>
          <label className="input-label">Cheque no.</label>
          <input value={form.cheque_no} onChange={set('cheque_no')} className="input-field" />
        </div>
        <div>
          <label className="input-label">Bank</label>
          <input value={form.bank} onChange={set('bank')} className="input-field" />
        </div>
        <div className="col-span-2">
          <label className="input-label">Against invoice</label>
          <select value={form.invoice_id} onChange={set('invoice_id')} className="input-field">
            <option value="">On account (no specific invoice)</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                Invoice {i.invoice_no} {i.client_pc ? `(${i.client_pc})` : ''} · balance {money(i.balance)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="input-label">Note</label>
          <input value={form.note} onChange={set('note')} className="input-field" />
        </div>
      </div>
      <ErrorLine text={err} />
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
        <button disabled={saving} className="btn-gradient-blue disabled:opacity-50" onClick={async () => {
          setSaving(true); setErr('');
          try { await onSave(form); } catch (e) { setErr(e.message); } finally { setSaving(false); }
        }}>Save</button>
      </div>
    </Modal>
  );
}

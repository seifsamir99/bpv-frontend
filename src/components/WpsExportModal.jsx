import React, { useMemo, useState } from 'react';
import { HiCash, HiDownload } from 'react-icons/hi';
import { autoMatch, wpsValues, companyName, downloadWpsWorkbook, ON_LEAVE } from '../utils/wpsExport';
import wpsApi from '../services/wpsApi';

const STATUS = {
  ok: { label: 'OK', className: 'bg-emerald-100 text-emerald-700' },
  cash: { label: 'Marked cash', className: 'bg-yellow-100 text-yellow-800' },
  leave: { label: 'No pay — On Leave', className: 'bg-amber-100 text-amber-800' },
  missing: { label: 'Not in payroll — On Leave', className: 'bg-amber-100 text-amber-800' },
};

// Stored employee_id for a line the office set to "not in payroll", so it
// isn't name-matched again next month ('' = never paired)
const NOT_IN_PAYROLL = '-';

// Preview of one company's WPS bank sheet for the month, built from the saved
// roster (wps_roster). Pairs each WPS line with a payroll employee, shows the
// fixed / variable / leave split, and lists bank-paid employees that are on
// neither company's WPS file (they are paid cash).
export default function WpsExportModal({
  compMol, roster, payrollRows, isCashEmployee, toggleCash,
  month, year, monthLabel, fmt, onClose, onPairingsSaved, onExported, onError,
}) {
  const company = companyName(compMol);
  const lines0 = useMemo(() => roster.filter(r => r.compMol === compMol), [roster, compMol]);
  const otherRoster = useMemo(() => roster.filter(r => r.compMol !== compMol), [roster, compMol]);

  // Employees already on the other company's file
  const otherIds = useMemo(
    () => new Set(otherRoster.map(r => r.employeeId).filter(id => id && id !== NOT_IN_PAYROLL)),
    [otherRoster]
  );

  const [matches, setMatches] = useState(() => {
    const saved = {};
    lines0.forEach(r => {
      if (r.employeeId === NOT_IN_PAYROLL) saved[r.molCode] = '';
      else if (r.employeeId) saved[r.molCode] = r.employeeId;
    });
    // Someone on the other company's file is never auto-matched here
    const candidates = payrollRows.filter(r => !otherIds.has(String(r.employeeId)));
    return autoMatch(lines0, candidates, saved);
  });
  const [include, setInclude] = useState({}); // { molCode: bool } — only rows the user ticked/unticked
  const [busy, setBusy] = useState(false);

  const byId = useMemo(
    () => Object.fromEntries(payrollRows.map(r => [String(r.employeeId), r])),
    [payrollRows]
  );
  const sortedPayroll = useMemo(
    () => [...payrollRows].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [payrollRows]
  );

  const lines = lines0.map(t => {
    const id = matches[t.molCode] || '';
    const row = byId[id];
    let status = 'ok';
    if (!row) status = 'missing';
    else if (isCashEmployee(id)) status = 'cash';
    else if (!(row.netSalary > 0)) status = 'leave';
    const values = status === 'ok' || status === 'cash'
      ? wpsValues(row)
      : { fixed: ON_LEAVE, variable: 0, leave: 0 };
    // Cash-marked people are left out unless ticked; everyone else stays in,
    // including On Leave rows (the office keeps them in the file)
    const included = include[t.molCode] ?? status !== 'cash';
    return { ...t, id, row, status, included, ...values };
  });
  const exported = lines.filter(l => l.included);
  const paid = exported.filter(l => typeof l.fixed === 'number' && l.fixed + l.variable > 0);
  const wpsTotal = paid.reduce((s, l) => s + l.fixed + l.variable, 0);

  const matchedIds = new Set(lines.map(l => l.id).filter(Boolean));
  const bankRows = payrollRows.filter(r => !isCashEmployee(r.employeeId) && r.netSalary > 0);
  const unlisted = bankRows.filter(r => !matchedIds.has(String(r.employeeId)));
  const otherRows = unlisted.filter(r => otherIds.has(String(r.employeeId)));
  const notInFile = unlisted.filter(r => !otherIds.has(String(r.employeeId)));
  const otherCompanies = [...new Set(otherRoster.map(r => r.compMol))].map(c => companyName(c));

  const sum = (rows) => rows.reduce((s, r) => s + (r.netSalary || 0), 0);
  const unmatchedCount = lines.filter(l => l.status === 'missing').length;

  // Pick an employee for a WPS row. An employee can only sit on one row, so
  // taking them away from another row clears that row.
  const setMatch = (molCode, id) => {
    setMatches(prev => {
      const next = { ...prev };
      if (id) Object.keys(next).forEach(k => { if (next[k] === id) next[k] = ''; });
      next[molCode] = id;
      return next;
    });
  };

  const markNotInFileAsCash = () => {
    notInFile.forEach(r => toggleCash(r.employeeId));
  };

  const download = async () => {
    setBusy(true);
    // Keep the pairings for next month
    const pairs = Object.fromEntries(lines0.map(t => [t.molCode, matches[t.molCode] || NOT_IN_PAYROLL]));
    const changed = Object.fromEntries(
      Object.entries(pairs).filter(([mol, id]) => lines0.find(t => t.molCode === mol).employeeId !== id)
    );
    try {
      if (Object.keys(changed).length) {
        await wpsApi.savePairings(changed);
        onPairingsSaved(changed);
      }
    } catch (err) {
      onError(`WPS pairings not saved: ${err.response?.data?.error || err.message}`);
    }
    try {
      const r = downloadWpsWorkbook(exported, month, year, company);
      onExported(`Downloaded ${r.fileName} — ${r.transfers} transfers, ${fmt(r.totalSalary)} + charges ${fmt(r.charges)}`);
    } catch (err) {
      onError(`WPS download failed: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">WPS — {company} — {monthLabel} {year}</h2>
            <p className="text-xs text-slate-500">
              MOL {compMol} · Fixed = net − (OT + bonus) · Variable = OT + bonus · Leave = absent days
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4">
          <div className="rounded-lg border border-blue-100 p-3">
            <div className="text-xs text-blue-500">This WPS file</div>
            <div className="text-lg font-bold text-blue-700">{fmt(wpsTotal)}</div>
            <div className="text-xs text-blue-400">{paid.length} transfers</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Bank in payroll (all companies)</div>
            <div className="text-lg font-bold text-slate-700">{fmt(sum(bankRows))}</div>
            <div className="text-xs text-slate-400">{bankRows.length} people</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">On {otherCompanies.length ? otherCompanies.join(' / ') : 'the other company'}'s file</div>
            <div className="text-lg font-bold text-slate-700">{fmt(sum(otherRows))}</div>
            <div className="text-xs text-slate-400">{otherRows.length} people</div>
          </div>
          <div className={`rounded-lg border p-3 ${notInFile.length ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}>
            <div className="text-xs text-yellow-700">Bank but on no WPS file</div>
            <div className="text-lg font-bold text-yellow-800">{fmt(sum(notInFile))}</div>
            <div className="text-xs text-yellow-600">{notInFile.length} people</div>
          </div>
        </div>

        <div className="px-5 mb-4">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">WPS name</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Payroll employee</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Fixed</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-emerald-600 uppercase">Variable</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Leave</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map(l => (
                  <tr key={l.molCode} className={`${l.status === 'ok' ? '' : 'bg-amber-50/50'} ${l.included ? '' : 'opacity-40'}`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={l.included}
                        onChange={() => setInclude(prev => ({ ...prev, [l.molCode]: !l.included }))}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        title="Include this row in the file"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-slate-800">{l.name}</div>
                      <div className="text-xs font-mono text-slate-400">{l.molCode}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={l.id}
                        onChange={(e) => setMatch(l.molCode, e.target.value)}
                        className="w-full max-w-[16rem] text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">— not in payroll —</option>
                        {sortedPayroll.map(r => (
                          <option key={r.employeeId} value={String(r.employeeId)}>
                            {r.name} (#{r.employeeId}){otherIds.has(String(r.employeeId)) ? ' — other company' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-700">
                      {typeof l.fixed === 'number' ? fmt(l.fixed) : <span className="text-amber-700">{l.fixed}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right text-emerald-600">{fmt(l.variable)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700">{l.leave}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[l.status].className}`}>
                        {STATUS[l.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bank-paid employees on neither company's WPS file */}
        {notInFile.length > 0 && (
          <div className="mx-5 mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-yellow-900">
                Marked Bank in payroll but on no WPS file — these are paid cash
              </span>
              <button
                onClick={markNotInFileAsCash}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 text-sm font-medium"
              >
                <HiCash className="w-4 h-4" /> Mark {notInFile.length} as Cash
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {notInFile.map(r => (
                <span key={r.employeeId} className="bg-white border border-yellow-200 rounded-full px-3 py-0.5 text-xs text-slate-700">
                  {r.name} · {fmt(r.netSalary)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-yellow-700">
              {otherCompanies.length === 0 && 'Only this company\'s WPS list is saved — upload the other company\'s file once so its people are told apart. '}
              Marking as cash changes the payroll table — click <b>Save Changes</b> afterwards to keep it.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            {unmatchedCount > 0 && `${unmatchedCount} WPS row${unmatchedCount === 1 ? '' : 's'} not matched — pick the employee or untick the row. `}
            Matches are saved for next month.
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={download}
              disabled={busy || exported.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <HiDownload className="w-4 h-4" />
              {busy ? 'Saving…' : 'Download .xls'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

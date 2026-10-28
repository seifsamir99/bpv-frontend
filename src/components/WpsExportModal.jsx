import React, { useMemo, useState } from 'react';
import { HiCash, HiDownload } from 'react-icons/hi';
import { autoMatch, wpsValues, companyName, loadWpsMemory, saveWpsMemory, downloadWpsWorkbook, ON_LEAVE } from '../utils/wpsExport';

const STATUS = {
  ok: { label: 'OK', className: 'bg-emerald-100 text-emerald-700' },
  cash: { label: 'Marked cash', className: 'bg-yellow-100 text-yellow-800' },
  leave: { label: 'No pay — On Leave', className: 'bg-amber-100 text-amber-800' },
  missing: { label: 'Not in payroll — On Leave', className: 'bg-amber-100 text-amber-800' },
};

// Preview of the WPS bank sheets: one section per uploaded file (Newell,
// Najmat Al Waad…). Pairs each WPS row with a payroll employee, shows the
// fixed / variable / leave split, and lists bank-paid employees that are in
// none of the companies' files (they are paid cash).
export default function WpsExportModal({
  templates, payrollRows, isCashEmployee, toggleCash,
  month, year, monthLabel, fmt, onClose, onExported,
}) {
  const [memory] = useState(loadWpsMemory);
  const allTemplateRows = useMemo(() => templates.flatMap(t => t.rows), [templates]);
  // Matched across all files together, so one employee never lands in two companies
  const [matches, setMatches] = useState(() => autoMatch(allTemplateRows, payrollRows, memory.map));
  const [include, setInclude] = useState({}); // { molCode: bool } — only rows the user ticked/unticked
  const [manualOther, setManualOther] = useState(() => new Set(memory.otherCompany.map(String)));

  const byId = useMemo(
    () => Object.fromEntries(payrollRows.map(r => [String(r.employeeId), r])),
    [payrollRows]
  );
  const sortedPayroll = useMemo(
    () => [...payrollRows].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [payrollRows]
  );

  const buildLine = (t) => {
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
  };

  const sections = templates.map(t => {
    const compMol = t.rows[0].compMol;
    const lines = t.rows.map(buildLine);
    const exported = lines.filter(l => l.included);
    const paid = exported.filter(l => typeof l.fixed === 'number' && l.fixed + l.variable > 0);
    return {
      key: `${compMol}:${t.name}`,
      compMol,
      company: companyName(compMol, t.name),
      fileName: t.name,
      lines,
      exported,
      paid,
      total: paid.reduce((s, l) => s + l.fixed + l.variable, 0),
    };
  });
  const allLines = sections.flatMap(s => s.lines);

  // Employees of companies whose file isn't loaded right now: remembered from
  // earlier exports, plus anyone flagged by hand
  const loadedCompanies = new Set(sections.map(s => s.compMol));
  const otherCompany = new Set(manualOther);
  Object.entries(memory.companies).forEach(([compMol, ids]) => {
    if (!loadedCompanies.has(compMol)) ids.forEach(id => otherCompany.add(String(id)));
  });

  const matchedIds = new Set(allLines.map(l => l.id).filter(Boolean));
  const bankRows = payrollRows.filter(r => !isCashEmployee(r.employeeId) && r.netSalary > 0);
  const unlisted = bankRows.filter(r => !matchedIds.has(String(r.employeeId)));
  const notInFile = unlisted.filter(r => !otherCompany.has(String(r.employeeId)));
  const otherRows = unlisted.filter(r => otherCompany.has(String(r.employeeId)));

  const wpsTotal = sections.reduce((s, sec) => s + sec.total, 0);
  const transferCount = sections.reduce((s, sec) => s + sec.paid.length, 0);
  const sum = (rows) => rows.reduce((s, r) => s + (r.netSalary || 0), 0);
  const unmatchedCount = allLines.filter(l => l.status === 'missing').length;

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

  const toggleOther = (id) => {
    setManualOther(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markNotInFileAsCash = () => {
    notInFile.forEach(r => toggleCash(r.employeeId));
  };

  const remember = () => {
    const companies = { ...memory.companies };
    sections.forEach(s => { companies[s.compMol] = s.lines.map(l => l.id).filter(Boolean); });
    // Someone now found in a loaded file no longer needs the manual flag
    const otherList = [...manualOther].filter(id => !matchedIds.has(id));
    saveWpsMemory({ map: { ...memory.map, ...matches }, companies, otherCompany: otherList });
  };

  const exportSections = (list) => {
    remember();
    const results = list
      .filter(s => s.exported.length > 0)
      .map(s => downloadWpsWorkbook(s.exported, month, year, s.company));
    onExported(results.map(r =>
      `Downloaded ${r.fileName} — ${r.transfers} transfers, ${fmt(r.totalSalary)} + charges ${fmt(r.charges)}`
    ).join(' · '));
  };

  const exportableCount = sections.filter(s => s.exported.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">WPS bank sheets — {monthLabel} {year}</h2>
            <p className="text-xs text-slate-500">
              Fixed = net − (OT + bonus) · Variable = OT + bonus · Leave = absent days
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4">
          <div className="rounded-lg border border-blue-100 p-3">
            <div className="text-xs text-blue-500">WPS total ({sections.length} {sections.length === 1 ? 'file' : 'files'})</div>
            <div className="text-lg font-bold text-blue-700">{fmt(wpsTotal)}</div>
            <div className="text-xs text-blue-400">{transferCount} transfers</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Bank in payroll</div>
            <div className="text-lg font-bold text-slate-700">{fmt(sum(bankRows))}</div>
            <div className="text-xs text-slate-400">{bankRows.length} people</div>
          </div>
          <div className={`rounded-lg border p-3 ${notInFile.length ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}>
            <div className="text-xs text-yellow-700">Bank but in no WPS file</div>
            <div className="text-lg font-bold text-yellow-800">{fmt(sum(notInFile))}</div>
            <div className="text-xs text-yellow-600">{notInFile.length} people</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Company file not loaded</div>
            <div className="text-lg font-bold text-slate-700">{fmt(sum(otherRows))}</div>
            <div className="text-xs text-slate-400">{otherRows.length} people</div>
          </div>
        </div>

        {/* One section per company file */}
        {sections.map(s => (
          <div key={s.key} className="px-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-semibold text-slate-800 text-sm">{s.company}</div>
                <div className="text-xs text-slate-400">
                  MOL {s.compMol} · from {s.fileName} · {s.paid.length} transfers · {fmt(s.total)}
                </div>
              </div>
              <button
                onClick={() => exportSections([s])}
                disabled={s.exported.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium disabled:opacity-50"
              >
                <HiDownload className="w-4 h-4" /> Export this file
              </button>
            </div>
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
                  {s.lines.map(l => (
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
                              {r.name} (#{r.employeeId})
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
        ))}

        {/* Bank-paid employees in none of the WPS files */}
        {(notInFile.length > 0 || otherRows.length > 0) && (
          <div className="mx-5 mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            {notInFile.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-yellow-900">
                    Marked Bank in payroll but in no WPS file — these are paid cash
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
                    <span key={r.employeeId} className="inline-flex items-center gap-2 bg-white border border-yellow-200 rounded-full pl-3 pr-1 py-0.5 text-xs text-slate-700">
                      {r.name} · {fmt(r.netSalary)}
                      <button
                        onClick={() => toggleOther(String(r.employeeId))}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        title="Belongs to a company whose WPS file isn't loaded — leave out of this list"
                      >
                        other co.
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
            {otherRows.length > 0 && (
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                In another company's WPS file (not loaded now):
                {otherRows.map(r => (
                  manualOther.has(String(r.employeeId)) ? (
                    <button
                      key={r.employeeId}
                      onClick={() => toggleOther(String(r.employeeId))}
                      className="px-2 py-0.5 rounded-full bg-white border border-slate-200 hover:bg-slate-100"
                      title="Click to move back to the list above"
                    >
                      {r.name} ✕
                    </button>
                  ) : (
                    <span key={r.employeeId} className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                      {r.name}
                    </span>
                  )
                ))}
              </div>
            )}
            {notInFile.length > 0 && (
              <p className="mt-2 text-xs text-yellow-700">
                {sections.length === 1 && 'Only one company file is loaded — pick both WPS files together to be sure. '}
                Marking as cash changes the payroll table — click <b>Save Changes</b> afterwards to keep it.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            {unmatchedCount > 0 && `${unmatchedCount} WPS row${unmatchedCount === 1 ? '' : 's'} not matched — pick the employee or untick the row. `}
            Matches are remembered for next month.
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={() => exportSections(sections)}
              disabled={exportableCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <HiDownload className="w-4 h-4" />
              {exportableCount > 1 ? `Export all (${exportableCount} files)` : 'Export .xls'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

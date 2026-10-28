import React, { useState, useMemo } from 'react';
import { HiClipboardList, HiChevronLeft, HiChevronRight, HiX, HiTrash, HiExclamation, HiPrinter, HiLocationMarker, HiPlus } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useLabourLog, { useLabourSites } from '../hooks/useLabourLog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The statuses the office can set on a logged day. `value` is what goes into
// the database and the attendance grid (it must match the backend's
// labour_log_service.STATUSES casing); `label` is what the office reads.
//
// Present is the only one that earns hours AND overtime — see hours_for() and
// earns_ot() in labour_log_service.py, which this mirrors. Sick is a paid day
// under the existing payroll rules (isPaidDay in payrollCalculation.js) but
// carries no OT, so it shows 8 / 0 in the grid rather than a letter.
//
// Resigned is TERMINAL: the day is unpaid and nothing after it counts, in this
// month or any later one. Hence the confirmation before saving it.
const STATUS_OPTIONS = [
  { value: 'Present',  label: 'Present',      letter: null, cell: '' },
  { value: 'Absent',   label: 'Absent',       letter: 'A',  cell: 'bg-red-50 text-red-600' },
  { value: 'Leave',    label: 'Leave',        letter: 'L',  cell: 'bg-amber-50 text-amber-700' },
  { value: 'Sick',     label: 'Sick',         letter: null, cell: 'bg-sky-50' },
  { value: 'Off',      label: 'OT only (Sunday)', letter: null, cell: 'bg-violet-50' },
  { value: 'Joined',  label: 'Joined',       letter: 'J',  cell: 'bg-emerald-50 text-emerald-700' },
  { value: 'Resigned', label: 'Left company', letter: 'LC', cell: 'bg-slate-200 text-slate-600' },
];

const STATUS_BY_VALUE = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

// Statuses that earn a full 8-hour day — the grid shows "hours / OT" for these
// and a letter for everything else. Mirrors PAID_STATUSES on the backend.
const PAID_STATUSES = ['Present', 'Off', 'Sick'];
const isPaidDay = (status) => PAID_STATUSES.includes(status);

// Only a worked day can carry overtime and a site, so the modal hides those
// two fields for anything else. Mirrors OT_STATUSES on the backend. Off is a
// Sunday worked as overtime only: the paid rest day plus OT, no normal hours.
const earnsOt = (status) => status === 'Present' || status === 'Off';
const isOtOnly = (status) => status === 'Off';

const statusLabel = (status) => STATUS_BY_VALUE[status]?.label || status;

// The letter shown in a day cell, or null when the cell shows "hours / OT"
// instead. A paid day always shows its hours; anything unrecognised (an older
// row carrying a status this page predates, e.g. Holiday) falls back to its
// own initial rather than a meaningless placeholder.
const statusLetter = (status) => {
  if (status in STATUS_BY_VALUE) return STATUS_BY_VALUE[status].letter;
  return isPaidDay(status) ? null : String(status || '?').charAt(0).toUpperCase();
};

// The project sites that appear as chips on the engineers' phones. Kept apart
// from the LPO generator's delivery sites, which are a different list.
function SitesModal({ sites, onClose, onAdd, onDelete }) {
  const [newName, setNewName] = useState('');

  const add = () => {
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HiLocationMarker className="text-lime-500" /> Project Sites
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These are the chips the engineers tap on their phones.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            className="input-field flex-1"
            placeholder="New site name, e.g. G+13"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button className="btn-gradient-blue px-3 py-2" onClick={add}>
            <HiPlus className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {sites.length === 0 && (
            <li className="text-sm text-slate-400 text-center py-4">No sites yet</li>
          )}
          {sites.map((s) => (
            <li key={s} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-700">{s}</span>
              <button className="text-red-400 hover:text-red-600 ml-2" onClick={() => onDelete(s)}>
                <HiTrash className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400 mt-3">
          Removing a site only takes it off the phones — days already logged against it keep their record.
        </p>
      </div>
    </div>
  );
}

// Office correction of one logged day — the same three fields the engineer
// filled on his phone (site, OT, status), plus the office-only statuses
// (Joined / Left company) and delete for a day logged against the wrong man.
function EditModal({ employeeName, day, entry, onClose, onSave, onDelete }) {
  const [status, setStatus] = useState(entry.status || 'Present');
  const [otHours, setOtHours] = useState(entry.otHours ?? 0);
  const [sites, setSites] = useState(entry.sites || '');
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);

  // A day logged before this page knew the full list (or set from the
  // Attendance page, which also has Off and Holiday) keeps its own status as a
  // choice, so opening the modal to fix the OT can't silently re-label the day.
  const options = useMemo(() => (
    entry.status && !(entry.status in STATUS_BY_VALUE)
      ? [...STATUS_OPTIONS, { value: entry.status, label: entry.status }]
      : STATUS_OPTIONS
  ), [entry.status]);

  const handleSave = async () => {
    // Resigned ends the man's employment: this day is unpaid and every day
    // after it stops counting, in this month and every later one. Too costly to
    // reach by a stray click on a dropdown.
    if (status === 'Resigned' && entry.status !== 'Resigned'
        && !window.confirm(
          `Mark ${employeeName} as having LEFT THE COMPANY on day ${day}?\n\n`
          + 'This day is not paid, and no day after it will count towards pay '
          + 'in this month or any later month.')) return;

    setSaving(true);
    await onSave(entry.entryId, {
      status,
      otHours: earnsOt(status) ? parseFloat(otHours) || 0 : 0,
      sites,
      note,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove this day from the site log? The attendance cell is cleared and the month OT is re-totalled.')) return;
    setSaving(true);
    await onDelete(entry.entryId);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{employeeName} — day {day}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {entry.markedByName && (
          <p className="text-xs text-slate-500 mb-4">Logged by {entry.markedByName}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="input-label">Status</label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              {options.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {status === 'Resigned' && (
              <p className="mt-1.5 text-xs text-red-600">
                Ends employment — this day and every day after it stop counting towards pay.
              </p>
            )}
            {status === 'Sick' && (
              <p className="mt-1.5 text-xs text-slate-500">Paid day, no overtime.</p>
            )}
            {status === 'Leave' && (
              <p className="mt-1.5 text-xs text-slate-500">Unpaid day.</p>
            )}
            {status === 'Off' && (
              <p className="mt-1.5 text-xs text-slate-500">Paid rest day — only the OT hours are added.</p>
            )}
          </div>
          {earnsOt(status) && (
            <>
              <div>
                <label className="input-label">OT hours</label>
                <input
                  type="number" min="0" max="24" step="0.5" className="input-field"
                  value={otHours} onChange={(e) => setOtHours(e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Site(s)</label>
                <input
                  className="input-field" value={sites}
                  onChange={(e) => setSites(e.target.value)}
                  placeholder="G+13, G+4"
                />
              </div>
            </>
          )}
          <div>
            <label className="input-label">Note</label>
            <textarea rows={2} className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            title="Remove this day"
          >
            <HiTrash className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-gradient-blue disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One day cell: "hours / OT" on top, site underneath — attendance, hours and OT
// all readable at a glance. A non-working day shows its letter instead (A
// absent, L leave, J joined, LC left company); unlogged days are blank. Sick is
// a paid day, so it shows hours like a present one.
//
// A Sunday nobody logged is the paid rest day, the same default the attendance
// grid fills in, so it reads "Off" rather than looking like a missing day.
function DayCell({ entry, sunday, onClick }) {
  if (!entry) {
    return sunday ? (
      <td className="px-1 py-2 border-l border-slate-100 text-center bg-violet-50/50" title="Sunday — rest day">
        <span className="text-[10px] text-slate-400">Off</span>
      </td>
    ) : <td className="px-1 py-2 border-l border-slate-100" />;
  }

  const letter = statusLetter(entry.status);
  const meta = STATUS_BY_VALUE[entry.status];
  const worked = isPaidDay(entry.status);
  return (
    <td
      onClick={onClick}
      title={`${statusLabel(entry.status)}${worked ? ` — ${entry.hours}h worked, ${entry.otHours}h OT` : ''}${entry.sites ? ` — ${entry.sites}` : ''}${entry.markedByName ? ` (by ${entry.markedByName})` : ''}${entry.note ? `\n"${entry.note}"` : ''}`}
      className={`px-1 py-2 border-l border-slate-100 text-center cursor-pointer hover:bg-blue-50 ${
        meta?.cell || (entry.conflict ? 'bg-amber-50' : '')}`}
    >
      {letter ? (
        <span className="text-xs font-medium">{letter}</span>
      ) : isOtOnly(entry.status) ? (
        <>
          <div className="text-xs font-medium text-violet-700 whitespace-nowrap">
            OT <span className="text-amber-600">{entry.otHours}</span>
          </div>
          {entry.sites && (
            <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[64px]">{entry.sites}</div>
          )}
        </>
      ) : (
        <>
          <div className="text-xs font-medium text-slate-700 whitespace-nowrap">
            {entry.hours}
            <span className="text-slate-300"> / </span>
            <span className={entry.otHours ? 'text-amber-600' : 'text-slate-400'}>{entry.otHours}</span>
          </div>
          {entry.sites && (
            <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[64px]">{entry.sites}</div>
          )}
        </>
      )}
      {entry.conflict && <div className="text-[10px] text-amber-600 leading-none">!</div>}
    </td>
  );
}

export default function SiteLogPage() {
  const now = new Date();
  // Salaries run a month behind, so the office is normally reviewing the month
  // that just ended — same default as Attendance / Month-End / Payroll.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(prev.getMonth());
  const [year, setYear] = useState(prev.getFullYear());
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [showSites, setShowSites] = useState(false);

  const { rows, loading, error, updateEntry, deleteEntry } = useLabourLog(month, year);
  const { sites, addSite, deleteSite } = useLabourSites();

  const days = daysInMonth(month, year);
  const dayNumbers = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);
  const isSunday = (d) => new Date(year, month, d).getDay() === 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || String(r.employeeId).toLowerCase().includes(q));
  }, [rows, search]);

  const totalOt = filtered.reduce((sum, r) => sum + (r.totalOt || 0), 0);
  const totalHours = filtered.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const conflictCount = rows.filter((r) => r.hasConflict).length;

  const shiftMonth = (delta) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const handlePrint = () => {
    const head = dayNumbers.map((d) => `<th>${d}</th>`).join('');
    const body = filtered.map((r) => {
      const cells = dayNumbers.map((d) => {
        const e = r.days[d];
        if (!e) return isSunday(d) ? '<td class="site">Off</td>' : '<td></td>';
        const letter = statusLetter(e.status);
        if (letter) return `<td>${letter}</td>`;
        if (isOtOnly(e.status)) return `<td>OT ${e.otHours}<br><span class="site">${esc(e.sites)}</span></td>`;
        return `<td>${e.hours} / ${e.otHours}<br><span class="site">${esc(e.sites)}</span></td>`;
      }).join('');
      return `<tr><td class="name">${esc(r.name)}</td>${cells}`
        + `<td class="total">${r.totalHours}</td><td class="total">${r.totalOt}</td></tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Site Log ${MONTH_NAMES[month]} ${year}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px}
        h2{font-size:14px;margin:0 0 8px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #999;padding:2px;text-align:center}
        td.name{text-align:left;white-space:nowrap}
        td.total{font-weight:bold}
        .site{font-size:7px;color:#666}
        @page{size:landscape}
      </style></head><body>
      <h2>Labour Site Log — ${MONTH_NAMES[month]} ${year}
        <span style="font-weight:normal;font-size:10px">(cell = hours / OT, then site &middot; OT n = Sunday, overtime only &middot; A = absent)</span></h2>
      <table><thead><tr><th>Name</th>${head}<th>Hours</th><th>OT</th></tr></thead><tbody>${body}</tbody></table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Site Log"
        subtitle="Daily labour sheet filled by the site engineers"
        icon={HiClipboardList}
        onAction={handlePrint}
        actionLabel="Print"
        actionIcon={HiPrinter}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <HiChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-slate-800 w-40 text-center">
                {MONTH_NAMES[month]} {year}
              </span>
              <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <HiChevronRight className="w-5 h-5" />
              </button>
            </div>

            <input
              className="input-field max-w-xs"
              placeholder="Search name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => setShowSites(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                title="Manage the sites the engineers can pick"
              >
                <HiLocationMarker className="w-4 h-4 text-lime-500" />
                Sites ({sites.length})
              </button>
              <span className="text-slate-500">
                Hours <span className="font-semibold text-slate-800">{totalHours}</span>
              </span>
              <span className="text-slate-500">
                OT <span className="font-semibold text-amber-600">{totalOt}</span> h
              </span>
              {conflictCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <HiExclamation className="w-4 h-4" />
                  {conflictCount} marked twice
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 sticky left-0 bg-slate-50 z-10">Name</th>
                  {dayNumbers.map((d) => (
                    <th
                      key={d}
                      title={isSunday(d) ? 'Sunday' : undefined}
                      className={`px-1 py-3 font-medium border-l border-slate-100 text-xs ${
                        isSunday(d) ? 'text-violet-600 bg-violet-50' : 'text-slate-500'}`}
                    >
                      {d}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium text-slate-600 border-l border-slate-200">Hours</th>
                  <th className="px-3 py-3 font-medium text-amber-600 border-l border-slate-100">OT</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.employeeId} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-2 sticky left-0 bg-white z-10">
                      <div className="font-medium text-slate-800 whitespace-nowrap">{row.name}</div>
                      <div className="text-xs text-slate-400">
                        {row.employeeId} · {row.presentDays}P {row.absentDays}A
                      </div>
                    </td>
                    {dayNumbers.map((d) => (
                      <DayCell
                        key={d}
                        entry={row.days[d]}
                        sunday={isSunday(d)}
                        onClick={() => row.days[d] && setEditing({ name: row.name, day: d, entry: row.days[d] })}
                      />
                    ))}
                    <td className="px-3 py-2 border-l border-slate-200 text-center font-semibold text-slate-800">
                      {row.totalHours || '—'}
                    </td>
                    <td className="px-3 py-2 border-l border-slate-100 text-center font-semibold text-amber-600">
                      {row.totalOt || '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={days + 3} className="p-8 text-center text-slate-400">
                      No labours found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Each cell reads <span className="font-medium text-slate-500">hours / OT</span> with the
          site underneath; blank means the day was never logged.{' '}
          <span className="font-medium text-red-600">A</span> absent,{' '}
          <span className="font-medium text-amber-700">L</span> leave,{' '}
          <span className="font-medium text-emerald-700">J</span> joined,{' '}
          <span className="font-medium text-slate-600">LC</span> left the company,{' '}
          <span className="font-medium text-violet-700">OT n</span> a Sunday worked as overtime
          only (paid rest day, no normal hours); a Sunday nobody logged shows Off. Hours come from
          the status — present and sick are full paid 8-hour days, since labour is paid per day
          plus OT; absent, leave, joined and left pay nothing, and only a present day can carry
          OT. Click a cell to correct it and the attendance grid and month OT total follow. Amber
          cells were marked by a second engineer on the same day.
        </p>
      </div>

      {showSites && (
        <SitesModal
          sites={sites}
          onClose={() => setShowSites(false)}
          onAdd={addSite}
          onDelete={deleteSite}
        />
      )}

      {editing && (
        <EditModal
          employeeName={editing.name}
          day={editing.day}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSave={updateEntry}
          onDelete={deleteEntry}
        />
      )}
    </div>
  );
}

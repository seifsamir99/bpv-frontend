import React, { useState, useMemo, useEffect } from 'react';
import { HiLocationMarker, HiChevronLeft, HiChevronRight, HiPencil, HiX, HiRefresh, HiPrinter } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useTimeLog from '../hooks/useTimeLog';
import useDayLog from '../hooks/useDayLog';
import useEmployees from '../hooks/useEmployees';
import timeEntriesApi, { saveAdminKey } from '../services/timeEntriesApi';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hoursWorked(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return '—';
  const ms = new Date(checkOutAt) - new Date(checkInAt);
  return (ms / 3600000).toFixed(1) + ' h';
}

function pad(n) { return String(n).padStart(2, '0'); }

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateHeading(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Converts an ISO timestamp to the value a <input type="datetime-local"> expects
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditModal({ entry, onClose, onSave }) {
  const [checkIn, setCheckIn] = useState(toLocalInput(entry.checkInAt));
  const [checkOut, setCheckOut] = useState(toLocalInput(entry.checkOutAt));
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(
      entry,
      checkIn ? new Date(checkIn).toISOString() : null,
      checkOut ? new Date(checkOut).toISOString() : null,
      note.trim() || null
    );
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            {entry.id ? 'Edit' : 'Check In'} — {entry.name} — {entry.entryDate}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="input-label">Check In</label>
            <input type="datetime-local" className="input-field" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Check Out</label>
            <input type="datetime-local" className="input-field" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Note</label>
              {note && (
                <button
                  type="button"
                  onClick={() => setNote('')}
                  className="text-xs text-slate-400 hover:text-red-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea rows={2} className="input-field" placeholder="Optional note (never shown to the engineer)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-gradient-blue disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationLink({ lat, lng }) {
  if (lat == null || lng == null) return null;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View location on map"
      className="inline-flex text-slate-400 hover:text-fuchsia-600"
    >
      <HiLocationMarker className="w-3.5 h-3.5" />
    </a>
  );
}

const STATUS_BADGE = {
  absent: 'bg-red-100 text-red-700',
  sick: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL = { absent: 'Absent', sick: 'Sick' };

function confirmReset(onReset, id) {
  if (window.confirm('Reset this entry? This clears the check-in/check-out for the day so the employee can start fresh.')) {
    onReset(id);
  }
}

// Month view row — one real time_entries row (no status-marking here; that's a
// Day view concept since it needs the full employee roster, not just entries).
// canEdit is false on any device without the admin key: view only.
function EntryRow({ entry, canEdit, onEdit, onReset }) {
  if (entry.status) {
    return (
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-800">{entry.name}</div>
          {entry.designation && <div className="text-xs text-slate-400">{entry.designation}</div>}
        </td>
        <td className="px-4 py-3" colSpan={3}>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[entry.status]}`}>
            {STATUS_LABEL[entry.status]}
          </span>
          {entry.note && <span className="ml-2 text-xs text-slate-400 italic">"{entry.note}"</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {canEdit && (
            <button
              onClick={() => confirmReset(onReset, entry.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Reset"
            >
              <HiRefresh className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{entry.name}</div>
        {entry.designation && <div className="text-xs text-slate-400">{entry.designation}</div>}
      </td>
      <td className="px-4 py-3 text-slate-700">
        <div className="flex items-center gap-1.5">
          {formatTime(entry.checkInAt)}
          <LocationLink lat={entry.checkInLat} lng={entry.checkInLng} />
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">
        <div className="flex items-center gap-1.5">
          {formatTime(entry.checkOutAt)}
          {entry.earlyLeave && <span className="text-xs text-orange-600">(early)</span>}
          <LocationLink lat={entry.checkOutLat} lng={entry.checkOutLng} />
        </div>
        {entry.note && <div className="text-xs text-slate-400 italic">"{entry.note}"</div>}
      </td>
      <td className="px-4 py-3 text-slate-700">{hoursWorked(entry.checkInAt, entry.checkOutAt)}</td>
      <td className="px-4 py-3 text-right">
        {canEdit && <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50"
            title="Edit times"
          >
            <HiPencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => confirmReset(onReset, entry.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            title="Reset"
          >
            <HiRefresh className="w-4 h-4" />
          </button>
        </div>}
      </td>
    </tr>
  );
}

// Day view row — one employee from the full roster (may have no entry at all
// yet), with the option to flag them Absent/Sick, undo that flag, or fully
// reset (e.g. they tapped Check In/Out by mistake). All of that only with
// canEdit (the admin device); everyone else gets the row read-only.
function DayRow({ row, canEdit, onEdit, onSetStatus, onReset }) {
  if (row.status) {
    return (
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-800">{row.name}</div>
          {row.designation && <div className="text-xs text-slate-400">{row.designation}</div>}
        </td>
        <td className="px-4 py-3" colSpan={3}>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status]}`}>
            {STATUS_LABEL[row.status]}
          </span>
          {row.note && <span className="ml-2 text-xs text-slate-400 italic">"{row.note}"</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {canEdit && (
            <button
              onClick={() => onSetStatus(row.employeeId, null)}
              className="text-xs text-slate-400 hover:text-fuchsia-600 underline"
            >
              Undo
            </button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{row.name}</div>
        {row.designation && <div className="text-xs text-slate-400">{row.designation}</div>}
      </td>
      <td className="px-4 py-3 text-slate-700">
        <div className="flex items-center gap-1.5">
          {formatTime(row.checkInAt)}
          <LocationLink lat={row.checkInLat} lng={row.checkInLng} />
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">
        <div className="flex items-center gap-1.5">
          {formatTime(row.checkOutAt)}
          {row.earlyLeave && <span className="text-xs text-orange-600">(early)</span>}
          <LocationLink lat={row.checkOutLat} lng={row.checkOutLng} />
        </div>
        {row.note && <div className="text-xs text-slate-400 italic">"{row.note}"</div>}
      </td>
      <td className="px-4 py-3 text-slate-700">{hoursWorked(row.checkInAt, row.checkOutAt)}</td>
      <td className="px-4 py-3 text-right">
        {canEdit && <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50"
            title={row.entryId ? 'Edit times' : 'Check in manually (no location needed for admin entries)'}
          >
            <HiPencil className="w-4 h-4" />
          </button>
          {row.entryId && (
            <button
              onClick={() => confirmReset(onReset, row.entryId)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Reset"
            >
              <HiRefresh className="w-4 h-4" />
            </button>
          )}
          {!row.checkInAt && (
            <>
              <button
                onClick={() => onSetStatus(row.employeeId, 'absent')}
                className="text-xs text-slate-400 hover:text-red-600 underline"
              >
                Mark Absent
              </button>
              <button
                onClick={() => onSetStatus(row.employeeId, 'sick')}
                className="text-xs text-slate-400 hover:text-amber-600 underline"
              >
                Mark Sick
              </button>
            </>
          )}
        </div>}
      </td>
    </tr>
  );
}

export default function TimeLogPage() {
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'month'
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Opening /time-log?admin=<key> once saves the key in this browser and makes
  // it the admin device; the key is taken straight back out of the address bar.
  // Every other device sees the Time Log view-only (the API enforces it too).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('admin');
    if (key) {
      saveAdminKey(key);
      params.delete('admin');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    timeEntriesApi.adminCheck()
      .then(res => setIsAdmin(Boolean(res.data?.admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  const [year, month] = selectedDate.split('-').map(Number); // month here is 1-12
  const { entries, loading: monthLoading, error: monthError, updateEntry, resetEntry } = useTimeLog(year, month, selectedEmployeeId || undefined);
  const { roster, loading: dayLoading, error: dayError, setStatus, updateEntry: updateDayEntry, resetEntry: resetDayEntry, manualCheckIn } = useDayLog(selectedDate, selectedEmployeeId || undefined);
  const { employees } = useEmployees();

  const loading = viewMode === 'day' ? dayLoading : monthLoading;
  const error = viewMode === 'day' ? dayError : monthError;

  const sortedEmployees = useMemo(
    () => employees.filter(e => e.timeLogEnabled).sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const groupedByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => { (map[e.entryDate] ||= []).push(e); });
    return Object.keys(map).sort().map(date => ({ date, items: map[date] }));
  }, [entries]);

  // Print the currently loaded month (respects the employee filter) as a
  // clean A4 table — same house style as the Payroll print sheet.
  const handlePrintMonth = () => {
    const rows = [...entries].sort((a, b) => (
      a.entryDate === b.entryDate ? a.name.localeCompare(b.name) : a.entryDate.localeCompare(b.entryDate)
    ));
    const employeeLabel = selectedEmployeeId
      ? (sortedEmployees.find(e => e.id === selectedEmployeeId)?.name || 'Employee')
      : 'All Engineers';

    const bodyRows = rows.map(r => {
      const statusOrTimes = r.status
        ? `<td colspan="3" class="l status">${r.status === 'sick' ? 'Sick' : 'Absent'}${r.note ? ` — ${esc(r.note)}` : ''}</td>`
        : `<td>${formatTime(r.checkInAt)}</td><td>${formatTime(r.checkOutAt)}${r.earlyLeave ? ' (early)' : ''}</td><td>${hoursWorked(r.checkInAt, r.checkOutAt)}</td>`;
      return `<tr>
        <td class="l">${esc(r.entryDate)}</td>
        <td class="l">${esc(r.name)}</td>
        <td class="l">${esc(r.designation)}</td>
        ${statusOrTimes}
        <td class="l note">${!r.status && r.note ? esc(r.note) : ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Time Log ${MONTH_NAMES[month - 1]} ${year} - ${esc(employeeLabel)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; }
  td.status { font-weight: bold; color: #b91c1c; }
  td.note { font-size: 9px; color: #475569; }
  .sign { margin-top: 45px; display: flex; justify-content: space-between; }
  .sign div { border-top: 1px solid #64748b; width: 28%; text-align: center; padding-top: 4px; color: #475569; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <div class="sub">Time Log — ${esc(employeeLabel)} — ${MONTH_NAMES[month - 1]} ${year}
    &nbsp;·&nbsp; ${rows.length} record(s) &nbsp;·&nbsp; printed ${new Date().toLocaleDateString('en-GB')}</div>
  <table>
    <thead><tr>
      <th>Date</th><th>Employee</th><th>Designation</th>
      <th>Check In</th><th>Check Out</th><th>Hours</th><th>Note</th>
    </tr></thead>
    <tbody>${bodyRows || '<tr><td colspan="7" class="l">No records for this month.</td></tr>'}</tbody>
  </table>
  <div class="sign"><div>Prepared by</div><div>Approved by</div></div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { window.alert('Popup blocked — allow popups for this site to print'); return; }
    w.document.write(html);
    w.document.close();
  };

  const handleSaveEdit = (entry, checkInAt, checkOutAt, note) => {
    if (viewMode === 'month') return updateEntry(entry.id, checkInAt, checkOutAt, note);
    // Day view: an existing entry is edited; a blank row (never checked in,
    // e.g. location was stuck denied) is created directly by the admin.
    return entry.id
      ? updateDayEntry(entry.id, checkInAt, checkOutAt, note)
      : manualCheckIn(entry.employeeId, checkInAt, checkOutAt, note);
  };

  const handleReset = (id) => (
    viewMode === 'day' ? resetDayEntry(id) : resetEntry(id)
  );

  const openDayEdit = (row) => {
    setEditingEntry({ id: row.entryId, employeeId: row.employeeId, name: row.name, entryDate: selectedDate, checkInAt: row.checkInAt, checkOutAt: row.checkOutAt });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader title="Time Log" subtitle="Site Check-In / Check-Out Times" icon={HiLocationMarker} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View mode + Employee filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 inline-flex gap-1">
            {[{ value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }].map(tab => (
              <button
                key={tab.value}
                onClick={() => setViewMode(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === tab.value ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!isAdmin && (
              <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full" title="Only the administrator's device can change the Time Log">
                View only
              </span>
            )}
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">All Employees</option>
              {sortedEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            {viewMode === 'month' && (
              <button onClick={handlePrintMonth} className="btn-gradient-blue flex items-center gap-2">
                <HiPrinter className="w-4 h-4" />
                <span>Print</span>
              </button>
            )}
          </div>
        </div>

        {viewMode === 'day' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedDate(d => shiftDate(d, -1))} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                <HiChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              />
              {selectedDate !== todayStr() && (
                <button onClick={() => setSelectedDate(todayStr())} className="px-3 py-1 text-xs font-medium bg-fuchsia-100 text-fuchsia-700 rounded-full hover:bg-fuchsia-200">
                  Today
                </button>
              )}
              <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                <HiChevronRight className="w-5 h-5" />
              </button>
            </div>
            <span className="text-slate-500 text-sm">{formatDateHeading(selectedDate)}</span>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center gap-3">
            <input
              type="month"
              value={selectedDate.slice(0, 7)}
              onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
              className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
            />
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

        {viewMode === 'day' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Check In</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Check Out</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Hours</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading…</td></tr>
                  )}
                  {!loading && roster.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">No employees found.</td></tr>
                  )}
                  {!loading && roster.map(row => (
                    <DayRow key={row.employeeId} row={row} canEdit={isAdmin} onEdit={openDayEdit} onSetStatus={setStatus} onReset={handleReset} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {loading && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-8 text-center text-slate-400">Loading…</div>
            )}
            {!loading && groupedByDate.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-8 text-center text-slate-400">No check-ins recorded for this month.</div>
            )}
            {!loading && groupedByDate.map(group => (
              <div key={group.date} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-medium text-slate-700 text-sm">
                  {formatDateHeading(group.date)}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Employee</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Check In</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Check Out</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">Hours</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(entry => (
                        <EntryRow key={entry.id} entry={entry} canEdit={isAdmin} onEdit={setEditingEntry} onReset={handleReset} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editingEntry && (
        <EditModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

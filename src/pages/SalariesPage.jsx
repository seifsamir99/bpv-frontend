import React, { useState, useMemo } from 'react';
import { HiUserGroup, HiSearch, HiSortDescending, HiCash, HiExclamationCircle, HiPrinter } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import SlideOutPanel from '../components/SlideOutPanel';
import { useEmployees } from '../hooks/useEmployees';

// Format number as AED currency
const formatAED = (amount) => {
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// The headline "what this employee gets" figure:
// staff have a monthly net salary; labour are paid per day.
const headlineSalary = (emp) => {
  if (emp.sheetType === 'staff') return { value: emp.netSalary, unit: '/month' };
  return { value: emp.ratePerDay, unit: '/day' };
};

// Escape values going into the printed HTML document
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Print the list exactly as filtered/sorted on screen: one table for labour
// (paid per day/hour), one for staff (monthly), each with its own totals.
function printSalaries(list) {
  const labour = list.filter(e => e.sheetType === 'labour');
  const staff = list.filter(e => e.sheetType === 'staff');
  const sum = (rows, field) => rows.reduce((s, e) => s + (e[field] || 0), 0);

  const labourTable = labour.length === 0 ? '' : `
  <h2>Labour (${labour.length})</h2>
  <table>
    <thead><tr>
      <th>#</th><th>ID</th><th class="l">Name</th><th class="l">Designation</th>
      <th>Rate/Hr</th><th>Rate/Day</th><th>Net Salary</th>
    </tr></thead>
    <tbody>${labour.map((e, i) => `<tr>
      <td>${i + 1}</td><td>${esc(e.id)}</td>
      <td class="l">${esc(e.name)}</td><td class="l">${esc(e.designation)}</td>
      <td>${formatAED(e.ratePerHour)}</td><td class="b">${formatAED(e.ratePerDay)}</td>
      <td>${formatAED(e.netSalary)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td colspan="6" class="l">TOTAL (${labour.length} labour)</td>
      <td>${formatAED(sum(labour, 'netSalary'))}</td>
    </tr></tfoot>
  </table>`;

  const staffTable = staff.length === 0 ? '' : `
  <h2>Staff (${staff.length})</h2>
  <table>
    <thead><tr>
      <th>#</th><th>ID</th><th class="l">Name</th><th class="l">Designation</th>
      <th>Deductions</th><th>Monthly Salary</th>
    </tr></thead>
    <tbody>${staff.map((e, i) => `<tr>
      <td>${i + 1}</td><td>${esc(e.id)}</td>
      <td class="l">${esc(e.name)}</td><td class="l">${esc(e.designation)}</td>
      <td>${formatAED(e.deductions)}</td><td class="b">${formatAED(e.netSalary)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td colspan="4" class="l">TOTAL (${staff.length} staff)</td>
      <td>${formatAED(sum(staff, 'deductions'))}</td><td>${formatAED(sum(staff, 'netSalary'))}</td>
    </tr></tfoot>
  </table>`;

  const html = `<!DOCTYPE html><html><head><title>Salaries - Newell Electromechanical Works</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; }
  .sub { color: #475569; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; }
  td.l, th.l { text-align: left; }
  td.b { font-weight: bold; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <div class="sub">Employee Salaries (AED) &nbsp;·&nbsp; ${list.length} employees &nbsp;·&nbsp; printed ${new Date().toLocaleDateString('en-GB')}</div>
  ${labourTable}
  ${staffTable}
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Popup blocked — allow popups for this site to print'); return; }
  w.document.write(html);
  w.document.close();
}

function SalaryEditForm({ employee, onSave, onClose }) {
  const isStaff = employee.sheetType === 'staff';
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ratePerDay: employee.ratePerDay ?? '',
    ratePerHour: employee.ratePerHour ?? '',
    netSalary: employee.netSalary ?? '',
    deductions: employee.deductions ?? '',
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Keep the three figures consistent: monthly net = rate/day × 30, rate/hour =
  // rate/day ÷ 8. Editing any one of them recalculates the other two.
  const setNetSalary = (value) => {
    setForm(prev => {
      const updated = { ...prev, netSalary: value };
      const net = parseFloat(value);
      if (net > 0) {
        const day = net / 30;
        updated.ratePerDay = day.toFixed(2);
        if (!isStaff) updated.ratePerHour = (day / 8).toFixed(2);
      }
      return updated;
    });
  };

  const setRatePerDay = (value) => {
    setForm(prev => {
      const updated = { ...prev, ratePerDay: value };
      const day = parseFloat(value);
      if (day > 0) {
        if (!isStaff) updated.ratePerHour = (day / 8).toFixed(2);
        updated.netSalary = (day * 30).toFixed(2);
      }
      return updated;
    });
  };

  const setRatePerHour = (value) => {
    setForm(prev => {
      const updated = { ...prev, ratePerHour: value };
      const hour = parseFloat(value);
      if (hour > 0) {
        const day = hour * 8;
        updated.ratePerDay = day.toFixed(2);
        updated.netSalary = (day * 30).toFixed(2);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    const data = {
      name: employee.name,
      ratePerDay: parseFloat(form.ratePerDay) || 0,
      netSalary: parseFloat(form.netSalary) || 0,
    };
    if (isStaff) {
      data.deductions = parseFloat(form.deductions) || 0;
    } else {
      data.ratePerHour = parseFloat(form.ratePerHour) || 0;
    }
    const result = await onSave(employee.id, data);
    setSaving(false);
    if (result && !result.success) {
      setSaveError(result.error || 'Error saving salary');
      return;
    }
    onClose();
  };

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <HiExclamationCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{saveError}</span>
        </div>
      )}

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="font-semibold text-slate-800">{employee.name}</p>
        <p className="text-sm text-slate-500">
          {employee.designation || 'No designation'} · {isStaff ? 'Staff' : 'Labour'} · ID {employee.id}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Rate Per Day (AED)</label>
          <input
            type="number"
            step="0.01"
            value={form.ratePerDay}
            onChange={(e) => setRatePerDay(e.target.value)}
            placeholder="0.00"
            className="input-field"
          />
        </div>
        {!isStaff && (
          <div>
            <label className="input-label">Rate Per Hour (AED)</label>
            <input
              type="number"
              step="0.01"
              value={form.ratePerHour}
              onChange={(e) => setRatePerHour(e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
        )}
        {isStaff && (
          <div>
            <label className="input-label">Deductions (AED)</label>
            <input
              type="number"
              step="0.01"
              value={form.deductions}
              onChange={(e) => set('deductions', e.target.value)}
              placeholder="0.00"
              className="input-field"
            />
          </div>
        )}
      </div>

      <div>
        <label className="input-label">{isStaff ? 'Net Salary / Month (AED)' : 'Net Salary (AED)'}</label>
        <input
          type="number"
          step="0.01"
          value={form.netSalary}
          onChange={(e) => setNetSalary(e.target.value)}
          placeholder="0.00"
          className="input-field"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <button onClick={handleSave} disabled={saving} className="btn-gradient-green flex-1">
          {saving ? 'Saving…' : 'Save Salary'}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SalariesPage() {
  const { employees, loading, error, updateEmployee } = useEmployees();
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  const processed = useMemo(() => {
    let result = employees;

    if (typeFilter !== 'all') {
      result = result.filter(e => e.sheetType === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        String(e.id).includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'salary-desc':
          return headlineSalary(b).value - headlineSalary(a).value;
        case 'salary-asc':
          return headlineSalary(a).value - headlineSalary(b).value;
        default:
          return 0;
      }
    });

    return result;
  }, [employees, searchQuery, typeFilter, sortBy]);

  const totals = useMemo(() => {
    const staff = employees.filter(e => e.sheetType === 'staff');
    const labour = employees.filter(e => e.sheetType === 'labour');
    return {
      labour: labour.length,
      staff: staff.length,
      staffMonthly: staff.reduce((sum, e) => sum + (e.netSalary || 0), 0),
    };
  }, [employees]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Salaries"
        subtitle="What each employee gets"
        icon={HiUserGroup}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Loading salaries...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-red-500">
              <p className="font-medium">Error loading salaries</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, designation or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                {['all', 'labour', 'staff'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      typeFilter === t
                        ? 'bg-emerald-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'labour' ? 'Labour' : 'Staff'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                <HiSortDescending className="w-4 h-4 text-slate-400 ml-2" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  <option value="salary-desc">Salary (High → Low)</option>
                  <option value="salary-asc">Salary (Low → High)</option>
                </select>
              </div>

              <button
                onClick={() => printSalaries(processed)}
                disabled={processed.length === 0}
                className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <HiPrinter className="w-4 h-4" />
                Print
              </button>
            </div>

            {/* Totals Bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-3 border border-emerald-100">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Labour</p>
                  <p className="text-lg font-bold text-slate-800">{totals.labour}</p>
                </div>
                <div className="h-8 w-px bg-emerald-200" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Staff</p>
                  <p className="text-lg font-bold text-slate-800">{totals.staff}</p>
                </div>
                <div className="h-8 w-px bg-emerald-200" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Staff Monthly Total</p>
                  <p className="text-lg font-bold text-emerald-600">{formatAED(totals.staffMonthly)} AED</p>
                </div>
              </div>
              {processed.length !== employees.length && (
                <p className="text-sm text-slate-500">
                  Showing {processed.length} of {employees.length}
                </p>
              )}
            </div>

            {/* No Results */}
            {processed.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <HiSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No employees found</p>
                  <button
                    onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}
                    className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}

            {/* Salary Cards */}
            {processed.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processed.map((emp) => {
                  const headline = headlineSalary(emp);
                  const isStaff = emp.sheetType === 'staff';
                  return (
                    <div
                      key={`${emp.sheetType}-${emp.id}`}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelected(emp)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isStaff ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                            <span className={`font-bold text-sm ${isStaff ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {emp.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800">{emp.name || 'Unknown'}</h3>
                            <p className="text-sm text-slate-500">{emp.designation || 'No designation'}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isStaff ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {isStaff ? 'Staff' : 'Labour'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500">
                          <HiCash className="w-4 h-4" />
                          <span className="text-xs">
                            {isStaff
                              ? (emp.deductions ? `Deductions ${formatAED(emp.deductions)}` : 'Monthly salary')
                              : `${formatAED(emp.ratePerHour)}/hr`}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-emerald-600">
                          {formatAED(headline.value)} <span className="text-xs font-medium text-slate-400">AED{headline.unit}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <SlideOutPanel
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Edit Salary - ${selected.name}` : ''}
      >
        {selected && (
          <SalaryEditForm
            employee={selected}
            onSave={updateEmployee}
            onClose={() => setSelected(null)}
          />
        )}
      </SlideOutPanel>
    </div>
  );
}

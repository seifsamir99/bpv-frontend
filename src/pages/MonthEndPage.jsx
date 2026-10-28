import React, { useState, useMemo } from 'react';
import { HiClock, HiSave, HiSearch, HiFilter, HiExclamationCircle, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useMonthEnd from '../hooks/useMonthEnd';
import getPrevMonth from '../utils/prevMonth';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEDUCTION_REASONS = [
  { value: '', label: 'No deduction' },
  { value: 'advance', label: 'Advance' },
  { value: 'damage', label: 'Damage' },
  { value: 'absence', label: 'Absence penalty' },
  { value: 'loan', label: 'Loan repayment' },
  { value: 'other', label: 'Other' },
];

export default function MonthEndPage() {
  // Salaries run one month behind — default to the previous month (July → June)
  const prev = getPrevMonth();
  const [selectedMonth, setSelectedMonth] = useState(prev.month);
  const [selectedYear, setSelectedYear] = useState(prev.year);
  const { entries, loading, error, saveEntries } = useMonthEnd(selectedMonth, selectedYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'labour' | 'staff'
  const [filterDesignation, setFilterDesignation] = useState('');
  const [localChanges, setLocalChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const monthName = MONTH_NAMES[selectedMonth];
  const isDefaultMonth = selectedMonth === prev.month && selectedYear === prev.year;

  // Guard: changing month with unsaved edits discards them
  const confirmDiscard = () => {
    if (Object.keys(localChanges).length === 0) return true;
    return window.confirm('You have unsaved changes for this month. Discard them and switch month?');
  };

  const changeMonth = (month, year) => {
    if (!confirmDiscard()) return;
    setLocalChanges({});
    setSaveError(null);
    setSaveSuccess(false);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const goToPrevMonth = () => {
    if (selectedMonth === 0) changeMonth(11, selectedYear - 1);
    else changeMonth(selectedMonth - 1, selectedYear);
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) changeMonth(0, selectedYear + 1);
    else changeMonth(selectedMonth + 1, selectedYear);
  };

  // Extract unique designations
  const designations = useMemo(() => {
    const desigs = entries.map(e => e.designation).filter(Boolean);
    return [...new Set(desigs)].sort();
  }, [entries]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return entries.filter(emp => {
      const matchesSearch = !searchQuery ||
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId?.toString().includes(searchQuery);
      const matchesType = filterType === 'all' || emp.type === filterType;
      const matchesDesignation = !filterDesignation ||
        emp.designation?.toLowerCase() === filterDesignation.toLowerCase();
      return matchesSearch && matchesType && matchesDesignation;
    });
  }, [entries, searchQuery, filterType, filterDesignation]);

  // Get local value or original value
  const getValue = (employeeId, field) => {
    if (localChanges[employeeId]?.[field] !== undefined) {
      return localChanges[employeeId][field];
    }
    const emp = entries.find(e => e.employeeId === employeeId);
    return emp?.[field] || '';
  };

  // Handle field change
  const handleChange = (employeeId, field, value) => {
    setLocalChanges(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
    setSaveSuccess(false);
  };

  // Check if there are unsaved changes
  const hasChanges = Object.keys(localChanges).length > 0;

  // Calculate totals
  const totalOT = filteredEmployees.reduce((sum, emp) => {
    return sum + (parseFloat(getValue(emp.employeeId, 'otHours')) || 0);
  }, 0);
  const totalBonus = filteredEmployees.reduce((sum, emp) => {
    return sum + (parseFloat(getValue(emp.employeeId, 'bonus')) || 0);
  }, 0);
  const totalDeductions = filteredEmployees.reduce((sum, emp) => {
    return sum + (parseFloat(getValue(emp.employeeId, 'deductionAmount')) || 0);
  }, 0);

  // Save all changes — sends every edited field (OT, bonus, deduction + reasons)
  // to the month_end table for the selected month.
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // One update per employee that has any edited field. The backend only
      // writes the keys present, so partial edits are safe.
      const updates = Object.entries(localChanges)
        .map(([employeeId, changes]) => ({ employeeId, ...changes }))
        .filter(u => Object.keys(u).length > 1);

      if (updates.length > 0) {
        const result = await saveEntries(updates);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save');
        }
      }

      setLocalChanges({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PageHeader
          title="Month End"
          subtitle={`${monthName} ${selectedYear}`}
          icon={HiClock}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="Month End"
        subtitle={`OT & Deductions - ${monthName} ${selectedYear}`}
        icon={HiClock}
        onAction={hasChanges ? handleSaveAll : undefined}
        actionLabel={saving ? 'Saving...' : 'Save All'}
        actionIcon={HiSave}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Month Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <HiChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => changeMonth(parseInt(e.target.value), selectedYear)}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => changeMonth(selectedMonth, parseInt(e.target.value))}
                className="text-lg font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {!isDefaultMonth && (
                <button
                  onClick={() => changeMonth(prev.month, prev.year)}
                  className="ml-2 px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                >
                  Salary Month
                </button>
              )}
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <HiChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
            <HiExclamationCircle className="w-5 h-5 flex-shrink-0" />
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-700">
            Changes saved successfully!
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Employees</div>
            <div className="text-2xl font-bold text-slate-800">{filteredEmployees.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total OT Hours</div>
            <div className="text-2xl font-bold text-amber-600">{totalOT.toFixed(1)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-4">
            <div className="text-sm text-emerald-600">Total Bonus</div>
            <div className="text-2xl font-bold text-emerald-600">{totalBonus.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4">
            <div className="text-sm text-red-500">Total Deductions</div>
            <div className="text-2xl font-bold text-red-600">{totalDeductions.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Unsaved Changes</div>
            <div className="text-2xl font-bold text-purple-600">{Object.keys(localChanges).length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Type Tabs */}
            <div className="inline-flex gap-1 bg-slate-100 rounded-lg p-1">
              {[
                { value: 'all', label: 'All' },
                { value: 'labour', label: 'Labour' },
                { value: 'staff', label: 'Staff' },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setFilterType(tab.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filterType === tab.value
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Designation Filter */}
            <div className="flex items-center gap-2">
              <HiFilter className="text-slate-400 w-5 h-5" />
              <select
                value={filterDesignation}
                onChange={(e) => setFilterDesignation(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Designations</option>
                {designations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* OT Entry Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                Enter OT Hours & Deductions
              </span>
              {hasChanges && (
                <span className="text-sm text-amber-600 font-medium">
                  {Object.keys(localChanges).length} unsaved changes
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Rate/Day</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">OT Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wider w-28">Bonus (+)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wider w-44">Bonus Reason</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wider w-36">Deduction Reason</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wider w-44">Deduction Note</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wider w-28">Deduction (−)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(employee => {
                  const otHours = getValue(employee.employeeId, 'otHours');
                  const bonus = getValue(employee.employeeId, 'bonus');
                  const bonusReason = getValue(employee.employeeId, 'bonusReason');
                  const deductionReason = getValue(employee.employeeId, 'deductionReason');
                  const deductionNote = getValue(employee.employeeId, 'deductionNote');
                  const deductionAmount = getValue(employee.employeeId, 'deductionAmount');
                  const hasLocalChange = localChanges[employee.employeeId];

                  return (
                    <tr
                      key={employee.employeeId}
                      className={`hover:bg-slate-50 ${hasLocalChange ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">#{employee.employeeId}</span>
                          <span className="font-medium text-slate-800">{employee.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            employee.type === 'staff'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {employee.type === 'staff' ? 'Staff' : 'Labour'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {employee.designation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">
                        {employee.ratePerDay?.toFixed(2)} AED
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={otHours}
                          onChange={(e) => handleChange(employee.employeeId, 'otHours', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="0"
                        />
                        {/* Auto-totalled from the engineers' daily Site Log. Typing
                            here pins the value (ot_source='manual') and the log
                            stops overwriting it. */}
                        {employee.otSource === 'log' && !localChanges[employee.employeeId]?.otHours && (
                          <div className="text-[10px] text-lime-600 text-center mt-1">from site log</div>
                        )}
                      </td>
                      {/* Bonus amount */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={bonus}
                          onChange={(e) => handleChange(employee.employeeId, 'bonus', e.target.value)}
                          className="w-full px-3 py-1.5 border border-emerald-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </td>
                      {/* Bonus reason (free text) */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={bonusReason}
                          onChange={(e) => handleChange(employee.employeeId, 'bonusReason', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Why the bonus / raise…"
                        />
                      </td>
                      {/* Deduction reason (category dropdown) */}
                      <td className="px-4 py-3">
                        <select
                          value={deductionReason}
                          onChange={(e) => handleChange(employee.employeeId, 'deductionReason', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          {DEDUCTION_REASONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      {/* Deduction note (free text) */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={deductionNote}
                          onChange={(e) => handleChange(employee.employeeId, 'deductionNote', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="Details…"
                        />
                      </td>
                      {/* Deduction amount */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={deductionAmount}
                          onChange={(e) => handleChange(employee.employeeId, 'deductionAmount', e.target.value)}
                          className="w-full px-3 py-1.5 border border-red-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No employees found matching your filters.
            </div>
          )}
        </div>

        {/* Floating Save Button for Mobile */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 sm:hidden">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 flex items-center justify-center disabled:opacity-50"
            >
              <HiSave className="w-6 h-6" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

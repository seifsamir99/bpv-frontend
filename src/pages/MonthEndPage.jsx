import React, { useState, useMemo } from 'react';
import { HiClock, HiSave, HiSearch, HiFilter, HiExclamationCircle } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useEmployees from '../hooks/useEmployees';

const DEDUCTION_REASONS = [
  { value: '', label: 'No deduction' },
  { value: 'advance', label: 'Advance' },
  { value: 'damage', label: 'Damage' },
  { value: 'absence', label: 'Absence penalty' },
  { value: 'loan', label: 'Loan repayment' },
  { value: 'other', label: 'Other' },
];

export default function MonthEndPage() {
  const { employees, loading, error, bulkUpdateOT, refresh } = useEmployees('labour');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [localChanges, setLocalChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Current month info
  const today = new Date();
  const currentMonth = today.toLocaleString('default', { month: 'long' });
  const currentYear = today.getFullYear();

  // Extract unique designations
  const designations = useMemo(() => {
    const desigs = employees.map(e => e.designation).filter(Boolean);
    return [...new Set(desigs)].sort();
  }, [employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = !searchQuery ||
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId?.toString().includes(searchQuery);
      const matchesDesignation = !filterDesignation ||
        emp.designation?.toLowerCase() === filterDesignation.toLowerCase();
      return matchesSearch && matchesDesignation;
    });
  }, [employees, searchQuery, filterDesignation]);

  // Get local value or original value
  const getValue = (employeeId, field) => {
    if (localChanges[employeeId]?.[field] !== undefined) {
      return localChanges[employeeId][field];
    }
    const emp = employees.find(e => e.employeeId === employeeId);
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
    const ot = parseFloat(getValue(emp.employeeId, 'otHours')) || 0;
    return sum + ot;
  }, 0);

  // Save all changes
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Prepare OT updates
      const otUpdates = Object.entries(localChanges)
        .filter(([_, changes]) => changes.otHours !== undefined)
        .map(([employeeId, changes]) => ({
          employeeId,
          otHours: parseFloat(changes.otHours) || 0
        }));

      if (otUpdates.length > 0) {
        const result = await bulkUpdateOT(otUpdates);
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

  // Flag employees with high OT
  const getOTWarning = (otHours) => {
    if (otHours > 80) return 'Very high OT - please verify';
    if (otHours > 50) return 'High OT hours';
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PageHeader
          title="Month End"
          subtitle={`${currentMonth} ${currentYear}`}
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
        subtitle={`OT & Deductions - ${currentMonth} ${currentYear}`}
        icon={HiClock}
        onAction={hasChanges ? handleSaveAll : undefined}
        actionLabel={saving ? 'Saving...' : 'Save All'}
        actionIcon={HiSave}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Employees</div>
            <div className="text-2xl font-bold text-slate-800">{filteredEmployees.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total OT Hours</div>
            <div className="text-2xl font-bold text-amber-600">{totalOT.toFixed(1)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Unsaved Changes</div>
            <div className="text-2xl font-bold text-purple-600">{Object.keys(localChanges).length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">OT Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">Deduction Reason</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">Deduction Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(employee => {
                  const otHours = getValue(employee.employeeId, 'otHours');
                  const deductionReason = getValue(employee.employeeId, 'deductionReason');
                  const deductionAmount = getValue(employee.employeeId, 'deductionAmount');
                  const warning = getOTWarning(parseFloat(otHours) || 0);
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
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={otHours}
                            onChange={(e) => handleChange(employee.employeeId, 'otHours', e.target.value)}
                            className={`w-full px-3 py-1.5 border rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              warning ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                            }`}
                            placeholder="0"
                          />
                          {warning && (
                            <div className="absolute left-0 right-0 -bottom-5 text-xs text-amber-600 text-center">
                              {warning}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={deductionReason}
                          onChange={(e) => handleChange(employee.employeeId, 'deductionReason', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {DEDUCTION_REASONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={deductionAmount}
                          onChange={(e) => handleChange(employee.employeeId, 'deductionAmount', e.target.value)}
                          disabled={!deductionReason}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
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

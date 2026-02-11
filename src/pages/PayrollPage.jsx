import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { HiCurrencyDollar, HiSave, HiRefresh, HiExclamationCircle, HiCash } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import useEmployees from '../hooks/useEmployees';
import useAttendance from '../hooks/useAttendance';
import usePayrollDraft from '../hooks/usePayrollDraft';
import { calculateLabourPayroll, calculateStaffPayroll } from '../utils/payrollCalculation';

const API_BASE_URL = 'https://bpv-backend-production.up.railway.app/api';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Editable cell component
function EditableCell({ value, onChange, isModified, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    const numVal = parseFloat(localValue) || 0;
    if (numVal !== value) {
      onChange(numVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-20 px-1 py-0.5 text-right text-sm border border-orange-400 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-orange-50 px-1 py-0.5 rounded ${isModified ? 'bg-yellow-100 font-semibold' : ''} ${className}`}
      title="Click to edit"
    >
      {fmt(value)}
    </span>
  );
}

export default function PayrollPage() {
  const today = new Date();
  const [selectedType, setSelectedType] = useState('labour');
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [payrollResults, setPayrollResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // New state for selections and edits
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [overrides, setOverrides] = useState({}); // { employeeId: { field: value, ... } }
  const [cashEmployees, setCashEmployees] = useState(new Set()); // Track cash payment employees
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'bank' | 'cash'

  const { employees, loading: empLoading, error: empError, refresh: refreshEmp } = useEmployees(selectedType);
  const { attendance, loading: attLoading, error: attError, refresh: refreshAtt } = useAttendance(selectedType);
  const { loadDraft, saveDraft, clearDraft, hasDraft, draftTimestamp } = usePayrollDraft(selectedType, selectedYear, selectedMonth);
  const isLoading = empLoading || attLoading;

  // Clear results when type changes
  useEffect(() => {
    setPayrollResults(null);
    setSaveSuccess(null);
    setSaveError(null);
    setSelectedIds(new Set());
    setOverrides({});
    setCashEmployees(new Set());
    setPaymentFilter('all');
  }, [selectedType]);

  // Auto-load payroll if previously saved for this month/year/type
  useEffect(() => {
    if (isLoading) return;

    const autoLoad = async () => {
      try {
        // Check if there's saved data for this period
        const res = await axios.get(`${API_BASE_URL}/payroll`, {
          params: { month: selectedMonth, year: selectedYear, type: selectedType }
        });

        if (res.data.success && res.data.data && res.data.data.length > 0 && res.data.savedFromSheet) {
          // Saved data exists - load directly from sheet (no recalculation)
          const savedData = res.data.data;
          setPayrollResults(savedData);

          const validIds = savedData.map(r => r.employeeId);
          setSelectedIds(new Set(validIds));
          setOverrides({});

          // Restore cash employees from saved data (normalize to strings)
          const savedCashIds = savedData
            .filter(row => row.isCash || row.paymentMethod === 'Cash')
            .map(row => String(row.employeeId));
          setCashEmployees(new Set(savedCashIds));

          setSaveSuccess(`Loaded ${savedData.length} records from saved data`);
        }
      } catch (err) {
        // No saved data or error - that's fine, user can calculate manually
        console.log('No saved payroll data for this period');
      }
    };

    autoLoad();
  }, [selectedMonth, selectedYear, selectedType, isLoading]);

  // Auto-save draft when overrides or cash selections change
  useEffect(() => {
    if (Object.keys(overrides).length > 0 || cashEmployees.size > 0) {
      saveDraft(overrides, selectedIds, cashEmployees);
    }
  }, [overrides, selectedIds, cashEmployees, saveDraft]);

  // --- Calculate ---
  const handleCalculate = async () => {
    if (isLoading) return;
    const results = selectedType === 'staff'
      ? calculateStaffPayroll(employees, attendance)
      : calculateLabourPayroll(employees, attendance);
    setPayrollResults(results);

    const validIds = results.map(r => r.employeeId);

    // Check for saved draft first (local storage)
    const draft = loadDraft();
    if (draft && (Object.keys(draft.overrides || {}).length > 0 || (draft.cashEmployeeIds || []).length > 0)) {
      setOverrides(draft.overrides || {});
      const restoredIds = (draft.selectedIds || []).filter(id => validIds.includes(id));
      setSelectedIds(new Set(restoredIds.length > 0 ? restoredIds : validIds));
      const restoredCash = (draft.cashEmployeeIds || []).filter(id => validIds.map(String).includes(String(id)));
      setCashEmployees(new Set(restoredCash.map(String)));
    } else {
      // No draft - try to load saved data from Google Sheets
      try {
        const res = await axios.get(`${API_BASE_URL}/payroll`, {
          params: { month: selectedMonth, year: selectedYear, type: selectedType }
        });
        if (res.data.success && res.data.data && res.data.data.length > 0) {
          // Restore cash employees from saved data (normalize to strings)
          const savedCashIds = res.data.data
            .filter(row => row.isCash || row.paymentMethod === 'Cash')
            .map(row => String(row.employeeId));
          const validIdStrings = validIds.map(String);
          const restoredCash = savedCashIds.filter(id => validIdStrings.includes(id));
          setCashEmployees(new Set(restoredCash));
        } else {
          setCashEmployees(new Set());
        }
      } catch (err) {
        console.error('Error loading saved payroll:', err);
        setCashEmployees(new Set());
      }
      // Select all by default
      setSelectedIds(new Set(validIds));
      setOverrides({});
    }

    setSaveSuccess(null);
    setSaveError(null);
  };

  // Apply overrides to get display data
  const displayData = useMemo(() => {
    if (!payrollResults) return [];
    return payrollResults.map(row => {
      const override = overrides[row.employeeId] || {};
      return {
        ...row,
        paidDays: override.paidDays !== undefined ? override.paidDays : row.paidDays,
        deductionAmount: override.deductionAmount !== undefined ? override.deductionAmount : row.deductionAmount,
        ratePerHour: override.ratePerHour !== undefined ? override.ratePerHour : row.ratePerHour,
        salaryBeforeOT: override.salaryBeforeOT !== undefined ? override.salaryBeforeOT : row.salaryBeforeOT,
        otHours: override.otHours !== undefined ? override.otHours : row.otHours,
        otPay: override.otPay !== undefined ? override.otPay : row.otPay,
        netSalary: override.netSalary !== undefined ? override.netSalary : row.netSalary,
      };
    });
  }, [payrollResults, overrides]);

  // Handle field override
  const handleOverride = (employeeId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      }
    }));
  };

  // Check if a field has been modified
  const isFieldModified = (employeeId, field) => {
    return overrides[employeeId]?.[field] !== undefined;
  };

  // Toggle single selection
  const toggleSelection = (employeeId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  // Toggle all selection
  const toggleSelectAll = () => {
    if (selectedIds.size === displayData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayData.map(r => r.employeeId)));
    }
  };

  // Toggle cash payment for an employee (normalize ID to string for consistent Set comparison)
  const toggleCash = (employeeId) => {
    const normalizedId = String(employeeId);
    setCashEmployees(prev => {
      const next = new Set(prev);
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      return next;
    });
  };

  // Helper to check if employee is marked as cash (handles type mismatches)
  const isCashEmployee = (employeeId) => cashEmployees.has(String(employeeId));

  // Filter display data by payment method
  const filteredDisplayData = useMemo(() => {
    if (paymentFilter === 'all') return displayData;
    if (paymentFilter === 'cash') return displayData.filter(r => isCashEmployee(r.employeeId));
    if (paymentFilter === 'bank') return displayData.filter(r => !isCashEmployee(r.employeeId));
    return displayData;
  }, [displayData, paymentFilter, cashEmployees]);

  // Count cash vs bank employees
  const paymentCounts = useMemo(() => {
    const cash = displayData.filter(r => isCashEmployee(r.employeeId)).length;
    return { cash, bank: displayData.length - cash, total: displayData.length };
  }, [displayData, cashEmployees]);

  // --- Save to Google Sheet (only selected) ---
  const handleSave = async () => {
    if (!displayData || displayData.length === 0) return;

    // Capture current cash employees as a snapshot (avoid closure issues)
    const cashEmployeesSnapshot = new Set(cashEmployees);

    const dataToSave = displayData
      .filter(row => selectedIds.has(row.employeeId))
      .map(row => {
        // Check if this employee is marked as cash (normalize both to string for comparison)
        const employeeIdStr = String(row.employeeId);
        const isCash = cashEmployeesSnapshot.has(employeeIdStr);
        return {
          ...row,
          isCash,
          paymentMethod: isCash ? 'Cash' : 'Bank Transfer',
        };
      });

    if (dataToSave.length === 0) {
      setSaveError('No employees selected to save');
      return;
    }

    // Log for debugging (can remove later)
    const cashCount = dataToSave.filter(r => r.isCash).length;
    if (cashCount > 0) {
      console.log(`Saving ${cashCount} cash employees to Cash sheet`);
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/payroll`, {
        month: selectedMonth,
        year: selectedYear,
        type: selectedType,
        data: dataToSave,
      });
      if (res.data.success) {
        setSaveSuccess(res.data.message);
        clearDraft();
        setOverrides({});
        setCashEmployees(new Set());
      } else {
        setSaveError(res.data.error);
      }
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Totals (only selected employees with overrides applied) ---
  const totals = useMemo(() => {
    if (!displayData || displayData.length === 0) return null;
    const selectedData = displayData.filter(r => selectedIds.has(r.employeeId));
    if (selectedData.length === 0) return { count: 0, paidDays: 0, deductionAmount: 0, salaryBeforeOT: 0, otPay: 0, netSalary: 0, bankSalary: 0, cashSalary: 0, bankCount: 0, cashCount: 0 };

    return selectedData.reduce((acc, r) => {
      const isCash = isCashEmployee(r.employeeId);
      return {
        count: acc.count + 1,
        paidDays: acc.paidDays + (r.paidDays || 0),
        deductionAmount: acc.deductionAmount + (r.deductionAmount || 0),
        salaryBeforeOT: acc.salaryBeforeOT + (r.salaryBeforeOT || 0),
        otPay: acc.otPay + (r.otPay || 0),
        netSalary: acc.netSalary + (r.netSalary || 0),
        bankSalary: acc.bankSalary + (isCash ? 0 : (r.netSalary || 0)),
        cashSalary: acc.cashSalary + (isCash ? (r.netSalary || 0) : 0),
        bankCount: acc.bankCount + (isCash ? 0 : 1),
        cashCount: acc.cashCount + (isCash ? 1 : 0),
      };
    }, { count: 0, paidDays: 0, deductionAmount: 0, salaryBeforeOT: 0, otPay: 0, netSalary: 0, bankSalary: 0, cashSalary: 0, bankCount: 0, cashCount: 0 });
  }, [displayData, selectedIds, cashEmployees]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="Payroll"
        subtitle={`${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
        icon={HiCurrencyDollar}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Type Tabs */}
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 inline-flex gap-1">
            {[
              { value: 'labour', label: 'Labour' },
              { value: 'staff', label: 'Staff' },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setSelectedType(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === tab.value
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Payment Filter Tabs */}
          {displayData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 inline-flex gap-1">
              {[
                { value: 'all', label: `All (${paymentCounts.total})` },
                { value: 'bank', label: `Bank (${paymentCounts.bank})` },
                { value: 'cash', label: `Cash (${paymentCounts.cash})` },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setPaymentFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    paymentFilter === tab.value
                      ? tab.value === 'cash' ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.value === 'cash' && <HiCash className="w-4 h-4 inline mr-1" />}
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Month / Year + Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setPayrollResults(null); }}
                className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setPayrollResults(null); }}
                className="text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => { refreshEmp(); refreshAtt(); }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                title="Refresh data"
              >
                <HiRefresh className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 items-center">
              {/* Draft indicator */}
              {hasDraft && (Object.keys(overrides).length > 0 || cashEmployees.size > 0) && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span>Draft saved</span>
                  <button
                    onClick={() => {
                      clearDraft();
                      setOverrides({});
                      setCashEmployees(new Set());
                      if (payrollResults) {
                        setSelectedIds(new Set(payrollResults.map(r => r.employeeId)));
                      }
                    }}
                    className="ml-1 text-amber-400 hover:text-red-500 transition-colors"
                    title="Discard draft"
                  >
                    ✕
                  </button>
                </div>
              )}
              <button
                onClick={handleCalculate}
                disabled={isLoading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Calculate Payroll'}
              </button>
              {displayData.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving || selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <HiSave className="w-4 h-4" />
                  {saving ? 'Saving...' : `Save to Sheet (${selectedIds.size})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status messages */}
        {saveError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            <HiExclamationCircle className="w-5 h-5 flex-shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
            {saveSuccess}
          </div>
        )}
        {empError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            Employees: {empError}
          </div>
        )}
        {attError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            Attendance: {attError}
          </div>
        )}

        {/* Summary cards (only selected employees) */}
        {displayData.length > 0 && totals && (
          <div className={`grid gap-4 mb-6 ${selectedType === 'labour' ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <div className="text-xs text-slate-500">Employees</div>
              <div className="text-xl font-bold text-slate-800">{totals.count}</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <div className="text-xs text-slate-500">Total Paid Days</div>
              <div className="text-xl font-bold text-slate-800">{totals.paidDays}</div>
            </div>
            <div className="bg-white rounded-lg border border-red-100 shadow-sm p-3">
              <div className="text-xs text-red-500">Total Deductions</div>
              <div className="text-xl font-bold text-red-600">{fmt(totals.deductionAmount)}</div>
            </div>
            {selectedType === 'labour' && (
              <div className="bg-white rounded-lg border border-emerald-100 shadow-sm p-3">
                <div className="text-xs text-emerald-500">Total OT Pay</div>
                <div className="text-xl font-bold text-emerald-600">{fmt(totals.otPay)}</div>
              </div>
            )}
            <div className="bg-white rounded-lg border border-orange-100 shadow-sm p-3">
              <div className="text-xs text-orange-600">Total Net Salary</div>
              <div className="text-xl font-bold text-orange-700">{fmt(totals.netSalary)}</div>
            </div>
            {/* Bank vs Cash breakdown */}
            <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-3">
              <div className="text-xs text-blue-500">Bank Transfer</div>
              <div className="text-lg font-bold text-blue-600">{fmt(totals.bankSalary)}</div>
              <div className="text-xs text-blue-400">{totals.bankCount} people</div>
            </div>
            <div className="bg-yellow-50 rounded-lg border border-yellow-300 shadow-sm p-3">
              <div className="text-xs text-yellow-600 flex items-center gap-1">
                <HiCash className="w-3 h-3" /> Cash
              </div>
              <div className="text-lg font-bold text-yellow-700">{fmt(totals.cashSalary)}</div>
              <div className="text-xs text-yellow-500">{totals.cashCount} people</div>
            </div>
          </div>
        )}

        {/* Results Table */}
        {displayData.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === displayData.length && displayData.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Designation</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-yellow-600 uppercase">Cash</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Paid Days</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-red-500 uppercase">Deductions</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Rate/Hr</th>
                    {selectedType === 'labour' && <>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Sal. B/F OT</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-500 uppercase">OT Hrs</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-500 uppercase">OT Pay</th>
                    </>}
                    <th className="px-3 py-3 text-right text-xs font-semibold text-orange-600 uppercase">Net Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDisplayData.map((row, i) => {
                    const isSelected = selectedIds.has(row.employeeId);
                    const isCash = isCashEmployee(row.employeeId);
                    return (
                      <tr
                        key={row.employeeId}
                        className={`transition-colors ${isCash ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50'} ${!isSelected ? 'opacity-40' : ''}`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(row.employeeId)}
                            className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 text-xs">{row.employeeId}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{row.designation}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => toggleCash(row.employeeId)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCash
                                ? 'bg-yellow-400 text-yellow-900 shadow-sm'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                            title={isCash ? 'Click to change to Bank Transfer' : 'Click to mark as Cash'}
                          >
                            <HiCash className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <EditableCell
                            value={row.paidDays}
                            onChange={(v) => handleOverride(row.employeeId, 'paidDays', v)}
                            isModified={isFieldModified(row.employeeId, 'paidDays')}
                            className="text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <EditableCell
                            value={row.deductionAmount}
                            onChange={(v) => handleOverride(row.employeeId, 'deductionAmount', v)}
                            isModified={isFieldModified(row.employeeId, 'deductionAmount')}
                            className="text-red-600"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <EditableCell
                            value={row.ratePerHour}
                            onChange={(v) => handleOverride(row.employeeId, 'ratePerHour', v)}
                            isModified={isFieldModified(row.employeeId, 'ratePerHour')}
                            className="text-slate-600"
                          />
                        </td>
                        {selectedType === 'labour' && <>
                          <td className="px-3 py-2.5 text-right">
                            <EditableCell
                              value={row.salaryBeforeOT}
                              onChange={(v) => handleOverride(row.employeeId, 'salaryBeforeOT', v)}
                              isModified={isFieldModified(row.employeeId, 'salaryBeforeOT')}
                              className="text-slate-700"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <EditableCell
                              value={row.otHours}
                              onChange={(v) => handleOverride(row.employeeId, 'otHours', v)}
                              isModified={isFieldModified(row.employeeId, 'otHours')}
                              className="text-emerald-600"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <EditableCell
                              value={row.otPay}
                              onChange={(v) => handleOverride(row.employeeId, 'otPay', v)}
                              isModified={isFieldModified(row.employeeId, 'otPay')}
                              className="text-emerald-600"
                            />
                          </td>
                        </>}
                        <td className="px-3 py-2.5 text-right">
                          <EditableCell
                            value={row.netSalary}
                            onChange={(v) => handleOverride(row.employeeId, 'netSalary', v)}
                            isModified={isFieldModified(row.employeeId, 'netSalary')}
                            className="text-orange-700 font-bold"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-3 py-3"></td>
                    <td colSpan={4} className="px-3 py-3 font-bold text-slate-700 text-sm">TOTAL ({totals?.count || 0} selected)</td>
                    <td className="px-3 py-3 text-center text-xs text-yellow-600">{totals?.cashCount || 0} cash</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">{totals?.paidDays || 0}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-600">{fmt(totals?.deductionAmount || 0)}</td>
                    <td className="px-3 py-3"></td>
                    {selectedType === 'labour' && <>
                      <td className="px-3 py-3 text-right font-bold text-slate-700">{fmt(totals?.salaryBeforeOT || 0)}</td>
                      <td className="px-3 py-3"></td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600">{fmt(totals?.otPay || 0)}</td>
                    </>}
                    <td className="px-3 py-3 text-right font-bold text-orange-700 text-base">{fmt(totals?.netSalary || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          /* Pre-calculate placeholder */
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HiCurrencyDollar className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Ready to calculate</h3>
            <p className="text-slate-500 text-sm">
              {isLoading
                ? 'Fetching employee and attendance data...'
                : `${employees.length} employees and ${attendance.length} attendance records loaded. Click "Calculate Payroll" to generate.`}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { HiCurrencyDollar, HiSave, HiRefresh, HiExclamationCircle, HiCash, HiPrinter, HiFolderOpen, HiPencilAlt, HiDocumentDownload } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
// Loaded on demand — it pulls in SheetJS, which nothing else on the page needs
const WpsExportModal = React.lazy(() => import('../components/WpsExportModal'));
import useEmployees from '../hooks/useEmployees';
import useAttendance from '../hooks/useAttendance';
import usePayrollDraft from '../hooks/usePayrollDraft';
import { calculateLabourPayroll, calculateStaffPayroll } from '../utils/payrollCalculation';
import getPrevMonth from '../utils/prevMonth';

import { API_BASE as API_BASE_URL } from '../services/apiBase';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Escape values going into the printed HTML documents below
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  // Salaries run one month behind — default to the previous month (July → June)
  const prevMonthDefault = getPrevMonth();
  const [selectedType, setSelectedType] = useState('labour');
  const [selectedMonth, setSelectedMonth] = useState(prevMonthDefault.month);
  const [selectedYear, setSelectedYear] = useState(prevMonthDefault.year);
  const [payrollResults, setPayrollResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // New state for selections and edits
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [overrides, setOverrides] = useState({}); // { employeeId: { field: value, ... } }
  const [cashEmployees, setCashEmployees] = useState(new Set()); // Track cash payment employees
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'bank' | 'cash'

  // Extra charges added under the totals row (bank transfer fee, WPS charges…).
  // Screen/print only — these are not employee pay, so they are never written
  // to the payroll table. Shape: { id, label, amount }
  const [extras, setExtras] = useState([]);

  // Print dropdown
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const printMenuRef = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target)) setShowPrintMenu(false);
    };
    if (showPrintMenu) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showPrintMenu]);

  // WPS bank sheet export: the office picks last month's WPS .xls files, one
  // per company (they hold the MOL codes and bank accounts), and the modal
  // refills them from the payroll
  const [wpsTemplates, setWpsTemplates] = useState(null); // [{ name, rows }]
  const wpsInputRef = useRef(null);

  const handleWpsFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = ''; // let the same files be picked again
    if (files.length === 0) return;
    let current = '';
    try {
      const { parseWpsTemplate } = await import('../utils/wpsExport');
      const templates = [];
      for (const file of files) {
        current = file.name;
        templates.push({ name: file.name, rows: parseWpsTemplate(await file.arrayBuffer()) });
      }
      setWpsTemplates(templates);
    } catch (err) {
      setSaveError(`WPS file ${current}: ${err.message}`);
    }
  };

  // Saved payroll history (list of all saved months from the database)
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/payroll/history`);
      if (res.data.success) setHistory(res.data.data);
    } catch (err) {
      console.error('Error loading payroll history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  const openHistoryEntry = (h) => {
    setSelectedType(h.type);
    setSelectedMonth(h.month);
    setSelectedYear(h.year);
    setShowHistory(false);
    // The auto-load effect picks the saved records up from the database
  };

  const isAllView = selectedType === 'all';
  // Column count of the results table — base 13 (checkbox, #, ID, Name,
  // Designation, Cash, Paid Days, Deductions, Rate/Hr, OT Hrs, OT Pay, Bonus,
  // Net Salary) plus Type in the All view and Sal. B/F OT in the Labour view.
  const tableCols = 13 + (isAllView ? 1 : 0) + (selectedType === 'labour' ? 1 : 0);
  const { employees, loading: empLoading, error: empError, refresh: refreshEmp } = useEmployees(isAllView ? null : selectedType);
  const { attendance, loading: attLoading, error: attError, refresh: refreshAtt } = useAttendance(selectedType, selectedMonth, selectedYear);
  const { loadDraft, saveDraft, clearDraft, hasDraft, draftTimestamp } = usePayrollDraft(selectedType, selectedYear, selectedMonth);
  const isLoading = empLoading || attLoading;

  // Clear results when type changes. Cash marks are kept — employee IDs are
  // global, so marks made on the Labour tab must survive switching to All
  // before saving (they used to be wiped here, silently losing the marks).
  useEffect(() => {
    setPayrollResults(null);
    setSaveSuccess(null);
    setSaveError(null);
    setSelectedIds(new Set());
    setOverrides({});
    setPaymentFilter('all');
  }, [selectedType]);

  // Cash marks are month-specific — reset them when the period changes
  useEffect(() => {
    setCashEmployees(new Set());
  }, [selectedMonth, selectedYear]);

  // Fetch saved payroll for the selected period. For the All view this pulls
  // labour + staff and merges them (labour first); every row gets empType.
  const fetchSavedPayroll = async () => {
    const types = selectedType === 'all' ? ['labour', 'staff'] : [selectedType];
    const responses = await Promise.all(types.map(t =>
      axios.get(`${API_BASE_URL}/payroll`, {
        params: { month: selectedMonth, year: selectedYear, type: t }
      }).then(res => ({ res, t })).catch(() => null)
    ));
    let rows = [];
    let anySaved = false;
    for (const item of responses) {
      if (!item) continue;
      const { res, t } = item;
      if (res.data.success && res.data.data && res.data.data.length > 0) {
        if (res.data.savedFromSheet) anySaved = true;
        rows = rows.concat(res.data.data.map(r => ({ ...r, empType: t })));
      }
    }
    return { rows, anySaved };
  };

  // Auto-load payroll if previously saved for this month/year/type
  useEffect(() => {
    if (isLoading) return;

    const autoLoad = async () => {
      try {
        const { rows: savedData, anySaved } = await fetchSavedPayroll();
        if (savedData.length > 0 && anySaved) {
          // Saved data exists - load directly (no recalculation)
          setPayrollResults(savedData);

          const validIds = savedData.map(r => r.employeeId);
          setSelectedIds(new Set(validIds));
          setOverrides({});

          // Restore cash employees from saved data, KEEPING any marks the user
          // already made locally (overwriting silently threw away unsaved marks)
          const savedCashIds = savedData
            .filter(row => row.isCash || row.paymentMethod === 'Cash')
            .map(row => String(row.employeeId));
          setCashEmployees(prev => new Set([...prev, ...savedCashIds]));

          setSaveSuccess(`Loaded ${savedData.length} records from saved data`);
        }
      } catch (err) {
        // No saved data or error - that's fine, user can calculate manually
        console.log('No saved payroll data for this period');
      }
    };

    autoLoad();
  }, [selectedMonth, selectedYear, selectedType, isLoading]);

  // Auto-save draft when overrides, cash selections or extra charges change
  useEffect(() => {
    if (Object.keys(overrides).length > 0 || cashEmployees.size > 0 || extras.length > 0) {
      saveDraft(overrides, selectedIds, cashEmployees, extras);
    }
  }, [overrides, selectedIds, cashEmployees, extras, saveDraft]);

  // --- Calculate ---
  const handleCalculate = async () => {
    if (isLoading) return;

    // Per-month OT/bonus/deduction entries from Month-End for the SELECTED month
    let adjustments = [];
    try {
      const adjRes = await axios.get(`${API_BASE_URL}/month-end`, {
        params: { month: selectedMonth, year: selectedYear }
      });
      if (adjRes.data.success) adjustments = adjRes.data.data;
    } catch (err) {
      console.error('Error loading month-end adjustments:', err);
    }

    let results;
    if (selectedType === 'all') {
      // Combined view: run each type's calc on its own employees, labour first
      const labourEmps = employees.filter(e => e.sheetType === 'labour');
      const staffEmps = employees.filter(e => e.sheetType === 'staff');
      results = [
        ...calculateLabourPayroll(labourEmps, attendance, adjustments).map(r => ({ ...r, empType: 'labour' })),
        ...calculateStaffPayroll(staffEmps, attendance, adjustments).map(r => ({ ...r, empType: 'staff' })),
      ];
    } else {
      results = (selectedType === 'staff'
        ? calculateStaffPayroll(employees, attendance, adjustments)
        : calculateLabourPayroll(employees, attendance, adjustments)
      ).map(r => ({ ...r, empType: selectedType }));
    }
    setPayrollResults(results);

    const validIds = results.map(r => r.employeeId);

    // Check for saved draft first (local storage)
    const draft = loadDraft();
    if (draft && (Object.keys(draft.overrides || {}).length > 0 || (draft.cashEmployeeIds || []).length > 0 || (draft.extras || []).length > 0)) {
      setOverrides(draft.overrides || {});
      setExtras(draft.extras || []);
      const restoredIds = (draft.selectedIds || []).filter(id => validIds.includes(id));
      setSelectedIds(new Set(restoredIds.length > 0 ? restoredIds : validIds));
      const restoredCash = (draft.cashEmployeeIds || []).filter(id => validIds.map(String).includes(String(id)));
      setCashEmployees(new Set(restoredCash.map(String)));
    } else {
      // No draft - restore cash markers from previously saved payroll data
      try {
        const { rows: savedRows } = await fetchSavedPayroll();
        if (savedRows.length > 0) {
          // Restore cash employees from saved data (normalize to strings)
          const savedCashIds = savedRows
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
      setExtras([]);
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
        bonus: override.bonus !== undefined ? override.bonus : row.bonus,
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

  // --- Extra charges (rows under the total) ---
  const addExtra = () => {
    setExtras(prev => [
      ...prev,
      { id: `x${Date.now()}${prev.length}`, label: '', amount: 0 },
    ]);
  };

  const updateExtra = (id, field, value) => {
    setExtras(prev => prev.map(x => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const removeExtra = (id) => {
    setExtras(prev => prev.filter(x => x.id !== id));
  };

  const extrasTotal = useMemo(
    () => extras.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0),
    [extras]
  );

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
      // Save only what changed: diff each row against the saved snapshot and
      // upsert just the differing ones (partial). A type with no saved data
      // yet gets a full first save. Payroll is stored per type, so the All
      // view saves labour and staff as separate writes.
      const num = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
      const fingerprint = (r, isCash) => JSON.stringify({
        nm: (r.name || '').trim(), ds: (r.designation || '').trim(),
        pd: num(r.paidDays), da: num(r.deductionAmount), rh: num(r.ratePerHour),
        sb: num(r.salaryBeforeOT), oh: num(r.otHours), op: num(r.otPay),
        bn: num(r.bonus), ns: num(r.netSalary),
        br: (r.bonusReason || '').trim(), dr: (r.deductionReason || '').trim(),
        dn: (r.deductionNote || '').trim(),
        pm: isCash ? 'Cash' : 'Bank Transfer',
      });

      const { rows: savedRows } = await fetchSavedPayroll();
      const savedMap = new Map(savedRows.map(r => [
        `${r.empType}:${r.employeeId}`,
        fingerprint(r, r.isCash || r.paymentMethod === 'Cash'),
      ]));
      const savedTypeCounts = savedRows.reduce((a, r) => {
        a[r.empType] = (a[r.empType] || 0) + 1;
        return a;
      }, {});

      const batches = (selectedType === 'all'
        ? [
            ['labour', dataToSave.filter(r => r.empType === 'labour')],
            ['staff', dataToSave.filter(r => r.empType !== 'labour')],
          ]
        : [[selectedType, dataToSave]]
      ).filter(([, rows]) => rows.length > 0);

      const messages = [];
      let wroteAnything = false;
      for (const [batchType, rows] of batches) {
        const hasSaved = (savedTypeCounts[batchType] || 0) > 0;
        // First save of this type → full snapshot; otherwise only changed rows
        const rowsToSend = hasSaved
          ? rows.filter(r => savedMap.get(`${batchType}:${r.employeeId}`) !== fingerprint(r, r.isCash))
          : rows;
        if (rowsToSend.length === 0) continue;

        // 30s timeout so the button can't hang forever if the connection drops
        // (e.g. a backend redeploy mid-request) — the save itself may still
        // have gone through; reloading shows the truth.
        const res = await axios.post(`${API_BASE_URL}/payroll`, {
          month: selectedMonth,
          year: selectedYear,
          type: batchType,
          data: rowsToSend,
          partial: hasSaved,
        }, { timeout: 30000 });
        if (!res.data.success) {
          setSaveError(res.data.error);
          return;
        }
        wroteAnything = true;
        messages.push(res.data.message);
      }
      setSaveSuccess(wroteAnything ? messages.join(' · ') : 'Nothing changed — everything is already saved');
      clearDraft();
      setOverrides({});
      // Cash marks stay visible — they now match what was just saved
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Print payroll sheets (browser print dialog → paper or PDF) ---
  // rows must carry a `payBy` ('Cash' | 'Bank') and optionally `empType`.
  const printSheet = (rows, subtitle, { includeSalBF = false, showType = false, extraCharges = [] } = {}) => {
    if (rows.length === 0) return;

    // Only charges that actually carry a value reach paper
    const printExtras = extraCharges.filter(x => (parseFloat(x.amount) || 0) !== 0);
    const printExtrasTotal = printExtras.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

    const t = rows.reduce((a, r) => ({
      paidDays: a.paidDays + (r.paidDays || 0),
      deductionAmount: a.deductionAmount + (r.deductionAmount || 0),
      otPay: a.otPay + (r.otPay || 0),
      bonus: a.bonus + (r.bonus || 0),
      netSalary: a.netSalary + (r.netSalary || 0),
      bank: a.bank + (r.payBy === 'Cash' ? 0 : (r.netSalary || 0)),
      cash: a.cash + (r.payBy === 'Cash' ? (r.netSalary || 0) : 0),
    }), { paidDays: 0, deductionAmount: 0, otPay: 0, bonus: 0, netSalary: 0, bank: 0, cash: 0 });

    const bodyRows = rows.map((r, i) => {
      const remarks = [r.bonusReason && `Bonus: ${r.bonusReason}`, r.deductionNote || r.deductionReason]
        .filter(Boolean).join(' · ');
      return `<tr>
        <td>${i + 1}</td><td>${esc(r.employeeId)}</td>
        <td class="l">${esc(r.name)}</td><td class="l">${esc(r.designation)}</td>
        ${showType ? `<td>${r.empType === 'staff' ? 'Staff' : 'Labour'}</td>` : ''}
        <td>${r.payBy}</td>
        <td>${fmt(r.paidDays)}</td><td>${fmt(r.deductionAmount)}</td><td>${fmt(r.ratePerHour)}</td>
        ${includeSalBF ? `<td>${fmt(r.salaryBeforeOT)}</td>` : ''}
        <td>${fmt(r.otHours)}</td><td>${fmt(r.otPay)}</td><td>${fmt(r.bonus)}</td>
        <td class="net">${fmt(r.netSalary)}</td>
        <td class="l remarks">${esc(remarks)}</td>
      </tr>`;
    }).join('');

    const leadCols = 5 + (showType ? 1 : 0); // #, ID, Name, Designation, [Type], Pay By
    // Full width: lead cols + Paid Days, Deductions, Rate/Hr, [Sal. B/F OT],
    // OT Hrs, OT Pay, Bonus, Net Salary, Remarks
    const printCols = leadCols + 8 + (includeSalBF ? 1 : 0);

    const extraRows = printExtras.map(x => `<tr>
      <td colspan="${printCols - 2}" class="l">${esc(x.label || 'Extra charge')}</td>
      <td class="net">${fmt(parseFloat(x.amount) || 0)}</td><td></td>
    </tr>`).join('');

    const grandTotalRow = printExtras.length > 0 ? `<tr>
      <td colspan="${printCols - 2}" class="l">GRAND TOTAL</td>
      <td class="net">${fmt(t.netSalary + printExtrasTotal)}</td><td></td>
    </tr>` : '';

    const html = `<!DOCTYPE html><html><head><title>Payroll ${MONTH_NAMES[selectedMonth]} ${selectedYear} - ${esc(subtitle)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; }
  td.l, th.l { text-align: left; }
  td.net { font-weight: bold; }
  td.remarks { font-size: 9px; color: #475569; max-width: 140px; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .summary { margin-top: 10px; display: flex; gap: 30px; font-size: 12px; }
  .sign { margin-top: 45px; display: flex; justify-content: space-between; }
  .sign div { border-top: 1px solid #64748b; width: 28%; text-align: center; padding-top: 4px; color: #475569; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <div class="sub">Payroll — ${esc(subtitle)} — ${MONTH_NAMES[selectedMonth]} ${selectedYear}
    &nbsp;·&nbsp; ${rows.length} employees &nbsp;·&nbsp; printed ${new Date().toLocaleDateString('en-GB')}</div>
  <table>
    <thead><tr>
      <th>#</th><th>ID</th><th class="l">Name</th><th class="l">Designation</th>
      ${showType ? '<th>Type</th>' : ''}
      <th>Pay By</th>
      <th>Paid Days</th><th>Deductions</th><th>Rate/Hr</th>
      ${includeSalBF ? '<th>Sal. B/F OT</th>' : ''}
      <th>OT Hrs</th><th>OT Pay</th><th>Bonus</th><th>Net Salary</th><th class="l">Remarks</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>
      <td colspan="${leadCols}" class="l">TOTAL (${rows.length} employees)</td>
      <td>${fmt(t.paidDays)}</td><td>${fmt(t.deductionAmount)}</td><td></td>
      ${includeSalBF ? '<td></td>' : ''}
      <td></td><td>${fmt(t.otPay)}</td><td>${fmt(t.bonus)}</td>
      <td class="net">${fmt(t.netSalary)}</td><td></td>
    </tr>${extraRows}${grandTotalRow}</tfoot>
  </table>
  <div class="summary">
    <span>Bank Transfer: <b>${fmt(t.bank)} AED</b></span>
    <span>Cash: <b>${fmt(t.cash)} AED</b></span>
    ${printExtras.length > 0 ? `<span>Extra Charges: <b>${fmt(printExtrasTotal)} AED</b></span>` : ''}
    <span>Grand Total: <b>${fmt(t.netSalary + printExtrasTotal)} AED</b></span>
  </div>
  <div class="sign"><div>Prepared by</div><div>Approved by</div><div>Received by</div></div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { setSaveError('Popup blocked — allow popups for this site to print'); return; }
    w.document.write(html);
    w.document.close();
  };

  // --- Print a wet-signature sheet for ONE type (labour alone / staff alone) ---
  // Mirrors the signature sheet the site has always used on paper:
  // ID · Name · Designation · Deductions · Paid Days · Rate/Hr · Total B/F OT ·
  // OT Hours · OT Pay · Net Salary · Signature (blank box the worker signs).
  // Pay By / Bonus / Remarks are deliberately dropped so the box stays wide.
  const printSignatureSheet = (rows, subtitle) => {
    if (rows.length === 0) return;

    // Only labour rows persist salary_before_ot; for staff, reconstruct the
    // pre-OT gross from the saved figures (net = gross + OT + bonus - deductions).
    const bfOT = (r) => (r.salaryBeforeOT !== undefined && r.salaryBeforeOT !== null)
      ? r.salaryBeforeOT
      : (r.netSalary || 0) - (r.otPay || 0) - (r.bonus || 0) + (r.deductionAmount || 0);

    const t = rows.reduce((a, r) => ({
      deductionAmount: a.deductionAmount + (r.deductionAmount || 0),
      paidDays: a.paidDays + (r.paidDays || 0),
      salaryBeforeOT: a.salaryBeforeOT + bfOT(r),
      otHours: a.otHours + (r.otHours || 0),
      otPay: a.otPay + (r.otPay || 0),
      netSalary: a.netSalary + (r.netSalary || 0),
    }), { deductionAmount: 0, paidDays: 0, salaryBeforeOT: 0, otHours: 0, otPay: 0, netSalary: 0 });

    const bodyRows = rows.map((r, i) => `<tr>
      <td>${i + 1}</td><td>${esc(r.employeeId)}</td>
      <td class="l">${esc(r.name)}</td><td class="l">${esc(r.designation)}</td>
      <td>${fmt(r.deductionAmount)}</td><td>${fmt(r.paidDays)}</td><td>${fmt(r.ratePerHour)}</td>
      <td>${fmt(bfOT(r))}</td><td>${fmt(r.otHours)}</td><td>${fmt(r.otPay)}</td>
      <td class="net">${fmt(r.netSalary)}</td>
      <td class="sigbox"></td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Payroll Signature Sheet ${esc(subtitle)} - ${MONTH_NAMES[selectedMonth]} ${selectedYear}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 4px 6px; text-align: right; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; }
  td { height: 26px; }
  td.l, th.l { text-align: left; }
  td.net { font-weight: bold; }
  td.sigbox { width: 18%; }
  th.sig { width: 18%; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  /* Repeat the header on every page and never split a person across pages */
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign div { border-top: 1px solid #64748b; width: 28%; text-align: center; padding-top: 4px; color: #475569; }
</style></head><body>
  <h1>Newell Electromechanical Works L.L.C</h1>
  <div class="sub">Salary Payment — Signature Sheet — ${esc(subtitle)} — ${MONTH_NAMES[selectedMonth]} ${selectedYear}
    &nbsp;·&nbsp; ${rows.length} employees &nbsp;·&nbsp; printed ${new Date().toLocaleDateString('en-GB')}</div>
  <table>
    <thead><tr>
      <th>#</th><th>ID</th><th class="l">Name of Employee</th><th class="l">Designation</th>
      <th>Deductions</th><th>Paid Days</th><th>Rate/Hr</th><th>Total B/F OT</th>
      <th>OT Hours</th><th>OT Pay</th><th>Net Salary</th><th class="sig">Signature</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>
      <td colspan="4" class="l">TOTAL (${rows.length} employees)</td>
      <td>${fmt(t.deductionAmount)}</td><td>${fmt(t.paidDays)}</td><td></td>
      <td>${fmt(t.salaryBeforeOT)}</td><td>${fmt(t.otHours)}</td><td>${fmt(t.otPay)}</td>
      <td class="net">${fmt(t.netSalary)}</td><td></td>
    </tr></tfoot>
  </table>
  <div class="sign"><div>Prepared by</div><div>Approved by</div><div>Paid by</div></div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { setSaveError('Popup blocked — allow popups for this site to print'); return; }
    w.document.write(html);
    w.document.close();
  };

  // Signature sheet for one type, from the SAVED payroll of the selected month.
  // method: 'Cash' | 'Bank' | null (everyone). Cash is the normal case — bank
  // transfers don't get signed for.
  const handlePrintSignature = async (type, method = 'Cash') => {
    setShowPrintMenu(false);
    const typeLabel = type === 'staff' ? 'Staff' : 'Labour';
    try {
      const res = await axios.get(`${API_BASE_URL}/payroll`, {
        params: { month: selectedMonth, year: selectedYear, type }
      });
      let rows = (res.data.success && res.data.data) ? res.data.data : [];
      if (method) {
        rows = rows.filter(r => ((r.isCash || r.paymentMethod === 'Cash') ? 'Cash' : 'Bank') === method);
      }
      if (rows.length === 0) {
        setSaveError(method
          ? `No saved ${method.toLowerCase()} ${typeLabel.toLowerCase()} payments for ${MONTH_NAMES[selectedMonth]} ${selectedYear} — mark them as ${method} and save first`
          : `No saved ${typeLabel.toLowerCase()} payroll for ${MONTH_NAMES[selectedMonth]} ${selectedYear} — save it first`);
        return;
      }
      printSignatureSheet(rows, method ? `${typeLabel} — ${method}` : typeLabel);
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    }
  };

  // Signature sheet from the on-screen ticked rows — the way to print a single
  // employee (or any subset). Untick "select all", tick who you want, print.
  const handlePrintSignatureSelected = () => {
    setShowPrintMenu(false);
    const rows = filteredDisplayData.filter(r => selectedIds.has(r.employeeId));
    if (rows.length === 0) {
      setSaveError('No employees ticked — tick the rows you want on the signature sheet');
      return;
    }
    const typeLabel = selectedType === 'all' ? 'Labour + Staff'
      : selectedType === 'labour' ? 'Labour' : 'Staff';
    const filterLabel = paymentFilter === 'cash' ? ' — Cash'
      : paymentFilter === 'bank' ? ' — Bank' : '';
    printSignatureSheet(rows, `${typeLabel}${filterLabel}`);
  };

  // Print the current on-screen view (selected rows, respects Bank/Cash tab)
  const handlePrint = () => {
    const rows = filteredDisplayData
      .filter(r => selectedIds.has(r.employeeId))
      .map(r => ({ ...r, payBy: isCashEmployee(r.employeeId) ? 'Cash' : 'Bank' }));
    const label = selectedType === 'all' ? 'All (Labour + Staff)'
      : selectedType === 'labour' ? 'Labour' : 'Staff';
    printSheet(rows, label, {
      includeSalBF: selectedType === 'labour',
      showType: selectedType === 'all',
      extraCharges: extras,
    });
  };

  // Print Labour + Staff combined from the SAVED payroll of the selected month.
  // method: 'Cash' | 'Bank' | null (everyone)
  const handlePrintAll = async (method) => {
    setShowPrintMenu(false);
    try {
      const [labRes, stRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/payroll`, { params: { month: selectedMonth, year: selectedYear, type: 'labour' } }),
        axios.get(`${API_BASE_URL}/payroll`, { params: { month: selectedMonth, year: selectedYear, type: 'staff' } }),
      ]);
      const tag = (res, empType) => (res.data.success ? res.data.data || [] : [])
        .map(r => ({ ...r, empType, payBy: (r.isCash || r.paymentMethod === 'Cash') ? 'Cash' : 'Bank' }));
      let rows = [...tag(labRes, 'labour'), ...tag(stRes, 'staff')];
      if (method) rows = rows.filter(r => r.payBy === method);
      if (rows.length === 0) {
        setSaveError(method
          ? `No saved ${method.toLowerCase()} payments for ${MONTH_NAMES[selectedMonth]} ${selectedYear} — save the payroll first`
          : `No saved payroll for ${MONTH_NAMES[selectedMonth]} ${selectedYear} — save it first`);
        return;
      }
      const label = method === 'Cash' ? 'Cash Payments (Labour + Staff)'
        : method === 'Bank' ? 'Bank Transfers (Labour + Staff)'
        : 'All Employees (Labour + Staff)';
      printSheet(rows, label, { showType: true });
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    }
  };

  // --- Totals (only selected employees with overrides applied) ---
  const totals = useMemo(() => {
    if (!displayData || displayData.length === 0) return null;
    const selectedData = displayData.filter(r => selectedIds.has(r.employeeId));
    if (selectedData.length === 0) return { count: 0, paidDays: 0, deductionAmount: 0, salaryBeforeOT: 0, otPay: 0, bonus: 0, netSalary: 0, bankSalary: 0, cashSalary: 0, bankCount: 0, cashCount: 0 };

    return selectedData.reduce((acc, r) => {
      const isCash = isCashEmployee(r.employeeId);
      return {
        count: acc.count + 1,
        paidDays: acc.paidDays + (r.paidDays || 0),
        deductionAmount: acc.deductionAmount + (r.deductionAmount || 0),
        salaryBeforeOT: acc.salaryBeforeOT + (r.salaryBeforeOT || 0),
        otPay: acc.otPay + (r.otPay || 0),
        bonus: acc.bonus + (r.bonus || 0),
        netSalary: acc.netSalary + (r.netSalary || 0),
        bankSalary: acc.bankSalary + (isCash ? 0 : (r.netSalary || 0)),
        cashSalary: acc.cashSalary + (isCash ? (r.netSalary || 0) : 0),
        bankCount: acc.bankCount + (isCash ? 0 : 1),
        cashCount: acc.cashCount + (isCash ? 1 : 0),
      };
    }, { count: 0, paidDays: 0, deductionAmount: 0, salaryBeforeOT: 0, otPay: 0, bonus: 0, netSalary: 0, bankSalary: 0, cashSalary: 0, bankCount: 0, cashCount: 0 });
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
              { value: 'all', label: 'All' },
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
              {hasDraft && (Object.keys(overrides).length > 0 || cashEmployees.size > 0 || extras.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span>Draft saved</span>
                  <button
                    onClick={() => {
                      clearDraft();
                      setOverrides({});
                      setCashEmployees(new Set());
                      setExtras([]);
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
                onClick={toggleHistory}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  showHistory ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
                title="View all saved payrolls"
              >
                <HiFolderOpen className="w-4 h-4" />
                Saved Payrolls
              </button>
              <button
                onClick={handleCalculate}
                disabled={isLoading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Calculate Payroll'}
              </button>
              <div className="relative" ref={printMenuRef}>
                <button
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  <HiPrinter className="w-4 h-4" />
                  Print
                </button>
                {showPrintMenu && (
                  <div className="absolute right-0 mt-1 z-50 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    {displayData.length > 0 && (() => {
                      // Exactly what handlePrint will print: current payment
                      // filter ∩ checkbox selection
                      const printCount = filteredDisplayData.filter(r => selectedIds.has(r.employeeId)).length;
                      const typeLabel = selectedType === 'all' ? 'Labour + Staff' : selectedType === 'labour' ? 'Labour' : 'Staff';
                      const filterLabel = paymentFilter === 'cash' ? ' · Cash only' : paymentFilter === 'bank' ? ' · Bank only' : '';
                      return (
                        <>
                          <button
                            onClick={() => { setShowPrintMenu(false); handlePrint(); }}
                            disabled={printCount === 0}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            This view ({typeLabel}{filterLabel}, {printCount} people)
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                        </>
                      );
                    })()}
                    <div className="px-3 py-1 text-xs text-slate-400 font-medium">
                      Signature sheet
                    </div>
                    {displayData.length > 0 && (() => {
                      const n = filteredDisplayData.filter(r => selectedIds.has(r.employeeId)).length;
                      return (
                        <button
                          onClick={handlePrintSignatureSelected}
                          disabled={n === 0}
                          className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-2"
                          title="Prints exactly the rows ticked in the table below"
                        >
                          <HiPencilAlt className="w-4 h-4" />
                          Ticked rows ({n} {n === 1 ? 'person' : 'people'})
                        </button>
                      );
                    })()}
                    <div className="px-3 py-1 text-xs text-slate-400">
                      from saved {MONTH_NAMES[selectedMonth]} payroll:
                    </div>
                    <button
                      onClick={() => handlePrintSignature('labour', 'Cash')}
                      className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                    >
                      <HiPencilAlt className="w-4 h-4" /> Labour — Cash only
                    </button>
                    <button
                      onClick={() => handlePrintSignature('staff', 'Cash')}
                      className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <HiPencilAlt className="w-4 h-4" /> Staff — Cash only
                    </button>
                    <button
                      onClick={() => handlePrintSignature('labour', null)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 pl-9"
                    >
                      Labour — everyone (cash + bank)
                    </button>
                    <button
                      onClick={() => handlePrintSignature('staff', null)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 pl-9"
                    >
                      Staff — everyone (cash + bank)
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <div className="px-3 py-1 text-xs text-slate-400 font-medium">
                      From saved {MONTH_NAMES[selectedMonth]} payroll — Labour + Staff
                    </div>
                    <button
                      onClick={() => handlePrintAll('Cash')}
                      className="w-full text-left px-3 py-2 text-sm text-yellow-700 hover:bg-yellow-50 flex items-center gap-2"
                    >
                      <HiCash className="w-4 h-4" /> All Cash payments
                    </button>
                    <button
                      onClick={() => handlePrintAll('Bank')}
                      className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      All Bank transfers
                    </button>
                    <button
                      onClick={() => handlePrintAll(null)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Everyone (all payments)
                    </button>
                  </div>
                )}
              </div>
              {displayData.length > 0 && (
                <>
                  <button
                    onClick={() => wpsInputRef.current?.click()}
                    disabled={!isAllView}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    title={isAllView ? "Pick last month's WPS .xls files (Newell + Najmat Al Waad together) to fill them from this payroll" : 'Switch to All to export WPS'}
                  >
                    <HiDocumentDownload className="w-4 h-4" />
                    WPS Excel
                  </button>
                  <input ref={wpsInputRef} type="file" accept=".xls,.xlsx" multiple onChange={handleWpsFiles} className="hidden" />
                </>
              )}
              {displayData.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving || selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <HiSave className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Saved payroll history */}
        {showHistory && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Saved Payrolls</span>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {historyLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No saved payrolls yet — calculate and save a month first.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {history.map(h => {
                  const isCurrent = h.month === selectedMonth && h.year === selectedYear && h.type === selectedType;
                  return (
                    <button
                      key={`${h.year}-${h.month}-${h.type}`}
                      onClick={() => openHistoryEntry(h)}
                      className={`w-full flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left transition-colors ${
                        isCurrent ? 'bg-purple-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium text-slate-800 w-36">
                        {MONTH_NAMES[h.month]} {h.year}
                        {isCurrent && <span className="ml-2 text-xs text-purple-600">(viewing)</span>}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        h.type === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {h.type === 'staff' ? 'Staff' : 'Labour'}
                      </span>
                      <span className="text-sm text-slate-500">{h.employees} employees</span>
                      {h.cashCount > 0 && (
                        <span className="text-xs text-yellow-600 flex items-center gap-1">
                          <HiCash className="w-3 h-3" /> {h.cashCount} cash
                        </span>
                      )}
                      {h.totalBonus > 0 && (
                        <span className="text-xs text-emerald-600">bonus {fmt(h.totalBonus)}</span>
                      )}
                      <span className="ml-auto font-bold text-orange-700">{fmt(h.totalNet)} AED</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
          <div className="grid gap-4 mb-6 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
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
            <div className="bg-white rounded-lg border border-emerald-100 shadow-sm p-3">
              <div className="text-xs text-emerald-500">Total OT Pay</div>
              <div className="text-xl font-bold text-emerald-600">{fmt(totals.otPay)}</div>
            </div>
            <div className="bg-white rounded-lg border border-emerald-100 shadow-sm p-3">
              <div className="text-xs text-emerald-500">Total Bonus</div>
              <div className="text-xl font-bold text-emerald-600">{fmt(totals.bonus)}</div>
            </div>
            <div className="bg-white rounded-lg border border-orange-100 shadow-sm p-3">
              <div className="text-xs text-orange-600">
                {extras.length > 0 ? 'Grand Total' : 'Total Net Salary'}
              </div>
              <div className="text-xl font-bold text-orange-700">
                {fmt(totals.netSalary + extrasTotal)}
              </div>
              {extras.length > 0 && (
                <div className="text-xs text-orange-400">incl. {fmt(extrasTotal)} extras</div>
              )}
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
                    {isAllView && <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Type</th>}
                    <th className="px-3 py-3 text-center text-xs font-semibold text-yellow-600 uppercase">Cash</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Paid Days</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-red-500 uppercase">Deductions</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Rate/Hr</th>
                    {selectedType === 'labour' && (
                      <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Sal. B/F OT</th>
                    )}
                    <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-500 uppercase">OT Hrs</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-500 uppercase">OT Pay</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-600 uppercase">Bonus</th>
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
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {row.name}
                          {row.endReason && (
                            <span
                              className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700 align-middle"
                              title={`${row.endReason} on ${row.endDate} — days from that date onwards are not counted`}
                            >
                              {row.endReason}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{row.designation}</td>
                        {isAllView && (
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row.empType === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {row.empType === 'staff' ? 'Staff' : 'Labour'}
                            </span>
                          </td>
                        )}
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
                        <td
                          className="px-3 py-2.5 text-right"
                          title={[row.deductionReason, row.deductionNote].filter(Boolean).join(' — ')}
                        >
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
                        {selectedType === 'labour' && (
                          <td className="px-3 py-2.5 text-right">
                            <EditableCell
                              value={row.salaryBeforeOT}
                              onChange={(v) => handleOverride(row.employeeId, 'salaryBeforeOT', v)}
                              isModified={isFieldModified(row.employeeId, 'salaryBeforeOT')}
                              className="text-slate-700"
                            />
                          </td>
                        )}
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
                        <td
                          className="px-3 py-2.5 text-right"
                          title={row.bonusReason ? `Bonus: ${row.bonusReason}` : ''}
                        >
                          <EditableCell
                            value={row.bonus}
                            onChange={(v) => handleOverride(row.employeeId, 'bonus', v)}
                            isModified={isFieldModified(row.employeeId, 'bonus')}
                            className="text-emerald-600"
                          />
                        </td>
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
                    <td colSpan={isAllView ? 5 : 4} className="px-3 py-3 font-bold text-slate-700 text-sm">TOTAL ({totals?.count || 0} selected)</td>
                    <td className="px-3 py-3 text-center text-xs text-yellow-600">{totals?.cashCount || 0} cash</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">{totals?.paidDays || 0}</td>
                    <td className="px-3 py-3 text-right font-bold text-red-600">{fmt(totals?.deductionAmount || 0)}</td>
                    <td className="px-3 py-3"></td>
                    {selectedType === 'labour' && (
                      <td className="px-3 py-3 text-right font-bold text-slate-700">{fmt(totals?.salaryBeforeOT || 0)}</td>
                    )}
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{fmt(totals?.otPay || 0)}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{fmt(totals?.bonus || 0)}</td>
                    <td className="px-3 py-3 text-right font-bold text-orange-700 text-base">{fmt(totals?.netSalary || 0)}</td>
                  </tr>

                  {/* Extra charges — transfer fees etc. Screen/print only, never saved with the payroll rows. */}
                  {extras.map(x => (
                    <tr key={x.id} className="bg-white">
                      <td className="px-3 py-2"></td>
                      <td colSpan={tableCols - 2} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeExtra(x.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none px-1"
                            title="Remove this charge"
                          >
                            &times;
                          </button>
                          {/* input-field is w-full — the wrapper sets the actual width */}
                          <div className="w-72">
                            <input
                              type="text"
                              value={x.label}
                              onChange={(e) => updateExtra(x.id, 'label', e.target.value)}
                              placeholder="Extra charge (e.g. Bank transfer fee)"
                              className="input-field text-sm"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="w-32 inline-block">
                          <input
                            type="number"
                            step="0.01"
                            value={x.amount}
                            onChange={(e) => updateExtra(x.id, 'amount', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="input-field text-sm text-right font-semibold"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-white">
                    <td className="px-3 py-2"></td>
                    <td colSpan={tableCols - 1} className="px-3 py-2">
                      <button
                        onClick={addExtra}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        + Add extra charge
                      </button>
                    </td>
                  </tr>

                  {/* Grand total — only meaningful once something extra is on the sheet */}
                  {extras.length > 0 && (
                    <tr className="bg-orange-50 border-t-2 border-orange-200">
                      <td className="px-3 py-3"></td>
                      <td colSpan={tableCols - 2} className="px-3 py-3 font-bold text-slate-700 text-sm">
                        GRAND TOTAL
                        <span className="ml-2 font-normal text-slate-500 text-xs">
                          net {fmt(totals?.netSalary || 0)} + extras {fmt(extrasTotal)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-orange-700 text-base">
                        {fmt((totals?.netSalary || 0) + extrasTotal)}
                      </td>
                    </tr>
                  )}
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

      {wpsTemplates && (
        <React.Suspense fallback={null}>
          <WpsExportModal
            templates={wpsTemplates}
            payrollRows={displayData}
            isCashEmployee={isCashEmployee}
            toggleCash={toggleCash}
            month={selectedMonth}
            year={selectedYear}
            monthLabel={MONTH_NAMES[selectedMonth]}
            fmt={fmt}
            onClose={() => setWpsTemplates(null)}
            onExported={(msg) => { setWpsTemplates(null); setSaveError(null); setSaveSuccess(msg); }}
          />
        </React.Suspense>
      )}
    </div>
  );
}

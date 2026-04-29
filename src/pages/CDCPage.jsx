import React, { useState, useEffect, useMemo } from 'react';
import { HiCreditCard, HiCalendar, HiViewList, HiClock, HiExclamation, HiCheckCircle, HiBan, HiExternalLink, HiPrinter, HiPlus, HiRefresh } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import AddChequeModal from '../components/AddChequeModal';
import axios from 'axios';
import { bpvApi } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Status options with colors - CDC uses Pending/Cleared
const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending', color: 'yellow', icon: HiClock },
  { value: 'Cleared', label: 'Cleared', color: 'green', icon: HiCheckCircle },
];

// Parse date string - handles both MM/DD/YYYY (Google Sheets) and DD/MM/YYYY formats
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    const year = parseInt(parts[2]);

    // If first number > 12, it must be DD/MM/YYYY format
    // Otherwise assume MM/DD/YYYY (Google Sheets default)
    if (first > 12) {
      // DD/MM/YYYY
      return new Date(year, second - 1, first);
    } else {
      // MM/DD/YYYY (Google Sheets format)
      return new Date(year, first - 1, second);
    }
  }
  return null;
};

// Format date for display
const formatDate = (dateStr) => {
  const date = parseDate(dateStr);
  if (!date) return dateStr || '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Format number as AED currency
const formatAED = (amount) => {
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Get background color based on week of month (for print)
const getWeekColor = (dateStr) => {
  const date = parseDate(dateStr);
  if (!date) return '#FFFFFF';
  const day = date.getDate();
  if (day <= 7) return '#E3F2FD';   // Week 1 - Light Blue
  if (day <= 14) return '#E8F5E9';  // Week 2 - Light Green
  if (day <= 21) return '#FFF8E1';  // Week 3 - Light Yellow
  if (day <= 28) return '#FCE4EC';  // Week 4 - Light Pink
  return '#F3E5F5';                  // Week 5 - Light Purple
};

// Month names for tabs
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CDCPage() {
  const [cdcs, setCdcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load saved preferences from localStorage or use defaults
  const [view, setView] = useState(() => {
    return localStorage.getItem('cdcView') || 'list';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('cdcStatusFilter') || 'all';
  });

  // Multi-select state
  const [selectedCdcs, setSelectedCdcs] = useState(new Set());

  // Add cheque modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printFrom, setPrintFrom] = useState('');
  const [printTo, setPrintTo] = useState('');
  const [printStatusFilter, setPrintStatusFilter] = useState('all');

  // Month/Year selection for filtering - load from localStorage or use current date
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem('cdcSelectedYear');
    return saved ? parseInt(saved) : new Date().getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem('cdcSelectedMonth');
    return saved !== null ? parseInt(saved) : new Date().getMonth();
  });

  // Fetch CDCs from BPV Manager and merge with standalone entries
  const fetchCdcs = async () => {
    try {
      setLoading(true);

      // 1. Load standalone CDCs from localStorage (manual entries not from BPV)
      const standaloneCdcs = JSON.parse(localStorage.getItem('cdcCheques') || '[]');

      // 2. Fetch BPV-linked CDCs and CDC statuses in parallel
      const [bpvResponse, statusResponse] = await Promise.all([
        bpvApi.getAll().catch(err => { console.error('BPV fetch failed:', err); return { data: [] }; }),
        fetch(`${API_BASE_URL}/cdc/statuses`).then(r => r.json()).catch(() => ({ data: {} })),
      ]);

      const cdcVouchers = (bpvResponse.data || []).filter(v => v.pdcType === 'CDC');
      const bpvLinkedCdcs = cdcVouchers.flatMap(voucher =>
        (voucher.lineItems || [])
          .filter(item => item.chequeNo && item.chequeDate)
          .map((item, idx) => ({
            id: `${voucher.bpvNo}-${idx}`,
            bpvNo: voucher.bpvNo,
            bpvDate: voucher.date,
            company: item.companyName || '',
            chequeNo: item.chequeNo,
            chequeDate: item.chequeDate,
            amount: parseFloat(item.debit) || 0,
            description: item.description || '',
            status: 'Pending', // Default, will be merged with saved status
          }))
      );

      // 3. Merge both sources
      const allCdcs = [...standaloneCdcs, ...bpvLinkedCdcs];

      // 4. Apply statuses from API (Google Sheets backend)
      const savedStatuses = statusResponse.data || {};
      allCdcs.forEach(cdc => {
        if (savedStatuses[cdc.chequeNo]) {
          cdc.status = savedStatuses[cdc.chequeNo];
        }
      });

      setCdcs(allCdcs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCdcs();
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cdcView', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('cdcStatusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('cdcSelectedYear', selectedYear.toString());
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem('cdcSelectedMonth', selectedMonth.toString());
  }, [selectedMonth]);

  // Filter CDCs by selected month/year and status
  const filteredCdcs = useMemo(() => {
    const filtered = cdcs.filter(cdc => {
      const date = parseDate(cdc.chequeDate);
      if (!date) return false;

      // Filter by month/year
      const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      if (!matchesMonth) return false;

      // Filter by status
      if (statusFilter !== 'all' && cdc.status !== statusFilter) return false;

      return true;
    });

    // Sort by cheque date (oldest to newest)
    return filtered.sort((a, b) => {
      const dateA = parseDate(a.chequeDate);
      const dateB = parseDate(b.chequeDate);
      return (dateA || 0) - (dateB || 0);
    });
  }, [cdcs, selectedMonth, selectedYear, statusFilter]);

  // Get available years from CDC data
  const availableYears = useMemo(() => {
    const years = new Set();
    cdcs.forEach(cdc => {
      const date = parseDate(cdc.chequeDate);
      if (date) years.add(date.getFullYear());
    });
    // Add current year if not present
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [cdcs]);

  // Stats for selected month
  const stats = useMemo(() => {
    // Get CDCs for selected month (without status filter)
    const monthCdcs = cdcs.filter(cdc => {
      const date = parseDate(cdc.chequeDate);
      return date && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const pending = monthCdcs.filter(p => p.status === 'Pending' || !p.status);
    const cleared = monthCdcs.filter(p => p.status === 'Cleared');

    const pendingTotal = pending.reduce((sum, p) => sum + (p.amount || 0), 0);
    const clearedTotal = cleared.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = monthCdcs.reduce((sum, p) => sum + (p.amount || 0), 0);

    return { pending, cleared, pendingTotal, clearedTotal, totalAmount, total: monthCdcs.length };
  }, [cdcs, selectedMonth, selectedYear]);

  // Persist status to localStorage for manual CDCs
  const saveStatusToLocal = (chequeNo, newStatus) => {
    const standaloneCdcs = JSON.parse(localStorage.getItem('cdcCheques') || '[]');
    const updated = standaloneCdcs.map(c =>
      c.chequeNo === chequeNo ? { ...c, status: newStatus } : c
    );
    localStorage.setItem('cdcCheques', JSON.stringify(updated));
  };

  // Handle status change - optimistic update, then save to backend
  const handleStatusChange = (cdc, newStatus) => {
    // Optimistic local update
    setCdcs(prev => prev.map(c => c.id === cdc.id ? { ...c, status: newStatus } : c));
    // Persist for manually-added CDCs
    if (String(cdc.id).startsWith('manual-')) {
      saveStatusToLocal(cdc.chequeNo, newStatus);
    }
    // Save to backend in background (fire-and-forget)
    fetch(`${API_BASE_URL}/cdc/status-by-cheque/${encodeURIComponent(cdc.chequeNo)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error('Failed to save CDC status to backend:', err));
  };

  // Handle bulk status change for selected CDCs
  const handleBulkStatusChange = (newStatus) => {
    if (selectedCdcs.size === 0) return;
    // Optimistic local update
    setCdcs(prev => prev.map(c =>
      selectedCdcs.has(c.chequeNo) ? { ...c, status: newStatus } : c
    ));
    // Persist manual CDCs to localStorage
    const standaloneCdcs = JSON.parse(localStorage.getItem('cdcCheques') || '[]');
    const updatedStandalone = standaloneCdcs.map(c =>
      selectedCdcs.has(c.chequeNo) ? { ...c, status: newStatus } : c
    );
    localStorage.setItem('cdcCheques', JSON.stringify(updatedStandalone));
    // Send to backend
    const updates = Array.from(selectedCdcs).map(chequeNo => ({ chequeNo, status: newStatus }));
    fetch(`${API_BASE_URL}/cdc/bulk-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    }).catch(err => console.error('Failed to bulk update CDC statuses:', err));
    setSelectedCdcs(new Set());
  };

  // Mark ALL visible CDCs with a status
  const [syncing, setSyncing] = useState(false);
  const handleMarkAll = (newStatus) => {
    const chequeNos = filteredCdcs.map(cdc => cdc.chequeNo).filter(Boolean);
    if (chequeNos.length === 0) { alert('No cheques to update'); return; }
    if (!confirm(`Mark all ${chequeNos.length} cheques as "${newStatus}"?`)) return;

    setSyncing(true);
    // Optimistic local update
    setCdcs(prev => prev.map(c =>
      chequeNos.includes(c.chequeNo) ? { ...c, status: newStatus } : c
    ));
    // Persist manual CDCs to localStorage
    const standaloneCdcs = JSON.parse(localStorage.getItem('cdcCheques') || '[]');
    const updatedStandalone = standaloneCdcs.map(c =>
      chequeNos.includes(c.chequeNo) ? { ...c, status: newStatus } : c
    );
    localStorage.setItem('cdcCheques', JSON.stringify(updatedStandalone));
    // Send to backend
    const updates = chequeNos.map(chequeNo => ({ chequeNo, status: newStatus }));
    fetch(`${API_BASE_URL}/cdc/bulk-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    }).catch(err => console.error('Failed:', err)).finally(() => setSyncing(false));
  };

  // Handle adding new cheque manually
  const handleAddCheque = (chequeData) => {
    // Load existing standalone CDCs
    const standaloneCdcs = JSON.parse(localStorage.getItem('cdcCheques') || '[]');

    // Add new cheque
    const newCheque = {
      id: `manual-${Date.now()}`,
      bpvNo: '',
      bpvDate: '',
      company: chequeData.company,
      chequeNo: chequeData.chequeNo,
      chequeDate: formatDateForDisplay(chequeData.chequeDate),
      amount: chequeData.amount,
      description: '',
      status: chequeData.status
    };

    standaloneCdcs.push(newCheque);

    // Save back to localStorage
    localStorage.setItem('cdcCheques', JSON.stringify(standaloneCdcs));

    // Refresh CDCs
    fetchCdcs();
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY for display
  const formatDateForDisplay = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Toggle selection for a single CDC
  const toggleCdcSelection = (chequeNo) => {
    setSelectedCdcs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chequeNo)) {
        newSet.delete(chequeNo);
      } else {
        newSet.add(chequeNo);
      }
      return newSet;
    });
  };

  // Toggle select all visible CDCs
  const toggleSelectAll = () => {
    if (selectedCdcs.size === filteredCdcs.length) {
      setSelectedCdcs(new Set());
    } else {
      setSelectedCdcs(new Set(filteredCdcs.map(cdc => cdc.chequeNo)));
    }
  };

  // Get status-based class for dropdown styling
  const getStatusClass = (status) => {
    return status === 'Cleared'
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-amber-100 text-amber-800 border-amber-300';
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    const colorClasses = {
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClasses[opt.color]}`}>
        <opt.icon className="w-3 h-3" />
        {opt.label}
      </span>
    );
  };

  // Open print modal with defaults from selected month
  const openPrintModal = () => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const mm = String(selectedMonth + 1).padStart(2, '0');
    setPrintFrom(`${selectedYear}-${mm}-01`);
    setPrintTo(`${selectedYear}-${mm}-${String(lastDay).padStart(2, '0')}`);
    setPrintStatusFilter('all');
    setIsPrintModalOpen(true);
  };

  // Handle print with date range
  const handlePrintMonth = () => {
    const fromDate = printFrom ? new Date(printFrom) : null;
    const toDate = printTo ? new Date(printTo + 'T23:59:59') : null;

    // Filter CDCs by date range and print status filter
    const rangeCdcs = cdcs.filter(cdc => {
      const date = parseDate(cdc.chequeDate);
      if (!date) return false;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      if (printStatusFilter !== 'all' && cdc.status !== printStatusFilter) return false;
      return true;
    });

    const sortedCdcs = [...rangeCdcs].sort((a, b) => {
      const dateA = parseDate(a.chequeDate);
      const dateB = parseDate(b.chequeDate);
      return (dateA || 0) - (dateB || 0);
    });

    const rangePending = rangeCdcs.filter(c => c.status === 'Pending' || !c.status);
    const rangeCleared = rangeCdcs.filter(c => c.status === 'Cleared');
    const rangeTotal = rangeCdcs.reduce((s, c) => s + (c.amount || 0), 0);
    const rangePendingTotal = rangePending.reduce((s, c) => s + (c.amount || 0), 0);
    const rangeClearedTotal = rangeCleared.reduce((s, c) => s + (c.amount || 0), 0);

    const dateRangeLabel = printFrom && printTo
      ? `${new Date(printFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(printTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : `${FULL_MONTHS[selectedMonth]} ${selectedYear}`;

    setIsPrintModalOpen(false);

    // Generate table rows with week-colored dates
    const tableRowsHtml = sortedCdcs.map(cdc => `
      <tr>
        <td style="text-align: center;">#${cdc.bpvNo || '-'}</td>
        <td>${cdc.company || '-'}</td>
        <td style="text-align: center;">${cdc.chequeNo || '-'}</td>
        <td style="text-align: center; background-color: ${getWeekColor(cdc.chequeDate)} !important; font-weight: 500;">${formatDate(cdc.chequeDate)}</td>
        <td style="text-align: right;">${formatAED(cdc.amount)} AED</td>
        <td style="text-align: center;">${cdc.status || 'Pending'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CDC Report - ${dateRangeLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333; }
          .header h1 { font-size: 16px; margin-bottom: 5px; }
          .header h2 { font-size: 20px; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #333; }
          .stats { display: flex; gap: 20px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .stat-item { flex: 1; }
          .stat-label { font-size: 11px; color: #666; }
          .stat-value { font-size: 14px; font-weight: bold; }
          .legend { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
          .legend-title { font-weight: bold; margin-bottom: 8px; font-size: 11px; }
          .legend-items { display: flex; flex-wrap: wrap; gap: 10px; }
          .legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; }
          .legend-color { width: 20px; height: 15px; border: 1px solid #ccc; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #ea580c; color: white; padding: 10px 8px; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px; border: 1px solid #ddd; font-size: 11px; }
          tr:nth-child(even) { background: #fafafa; }
          .total-row { background: #fed7aa !important; font-weight: bold; }
          .total-row td { border-top: 2px solid #333; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
          @media print {
            body { padding: 10px; }
            .legend { break-inside: avoid; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>NEWELL ELECTROMECHANICAL WORKS LLC</h1>
          <h2>CDC TRACKER REPORT</h2>
          <p>${dateRangeLabel} - ${rangeCdcs.length} CDCs (${formatAED(rangeTotal)} AED)</p>
        </div>

        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Pending</div>
            <div class="stat-value">${rangePending.length} CDCs - ${formatAED(rangePendingTotal)} AED</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Cleared</div>
            <div class="stat-value">${rangeCleared.length} CDCs - ${formatAED(rangeClearedTotal)} AED</div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-title">Week Color Legend (Date Column)</div>
          <div class="legend-items">
            <div class="legend-item"><div class="legend-color" style="background: #E3F2FD;"></div> Week 1 (1-7)</div>
            <div class="legend-item"><div class="legend-color" style="background: #E8F5E9;"></div> Week 2 (8-14)</div>
            <div class="legend-item"><div class="legend-color" style="background: #FFF8E1;"></div> Week 3 (15-21)</div>
            <div class="legend-item"><div class="legend-color" style="background: #FCE4EC;"></div> Week 4 (22-28)</div>
            <div class="legend-item"><div class="legend-color" style="background: #F3E5F5;"></div> Week 5 (29-31)</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">BPV #</th>
              <th>Company</th>
              <th style="width: 80px;">Cheque No</th>
              <th style="width: 100px;">Cheque Date</th>
              <th style="width: 110px;">Amount</th>
              <th style="width: 90px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${formatAED(rangeTotal)} AED</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          Generated on ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

      </body>
      </html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  // Generate calendar days for selected month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const days = [];

    // Padding for previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, cdcs: [] });
    }

    // Days of current month - use CDCs without status filter for calendar
    const monthCdcs = cdcs.filter(cdc => {
      const date = parseDate(cdc.chequeDate);
      return date && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dayCdcs = monthCdcs.filter(cdc => {
        const date = parseDate(cdc.chequeDate);
        return date && date.getDate() === d;
      });
      days.push({ day: d, cdcs: dayCdcs });
    }

    return days;
  }, [selectedYear, selectedMonth, cdcs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading CDCs from server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="CDC Tracker"
        subtitle="Current-Dated Cheques from BPV Manager"
        icon={HiCreditCard}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Backend error:</strong> {error} — Showing locally saved cheques only.
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center text-slate-500 hover:text-slate-700">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/pdc"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiCreditCard className="w-4 h-4" />
              PDC Tracker
            </Link>
            <Link
              to="/bpv"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiExternalLink className="w-4 h-4" />
              Manage CDCs in BPV Manager
            </Link>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiPlus className="w-4 h-4" />
              Add Cheque
            </button>
          </div>
        </div>

        {/* Month/Year Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Select Month:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1">
              {MONTHS.map((month, idx) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(idx)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedMonth === idx
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-800">
                {FULL_MONTHS[selectedMonth]} {selectedYear} - Total: {stats.total} CDCs ({formatAED(stats.totalAmount)} AED)
              </p>
              {selectedCdcs.size > 0 && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full border border-orange-300">
                  ✓ {selectedCdcs.size} selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <HiClock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-xl font-bold text-slate-800">{stats.pending.length}</p>
                <p className="text-xs text-slate-400">{formatAED(stats.pendingTotal)} AED</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <HiCheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Cleared</p>
                <p className="text-xl font-bold text-slate-800">{stats.cleared.length}</p>
                <p className="text-xs text-slate-400">{formatAED(stats.clearedTotal)} AED</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  view === 'list' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiViewList className="w-5 h-5" /> List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  view === 'calendar' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiCalendar className="w-5 h-5" /> Calendar
              </button>
              <button
                onClick={openPrintModal}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <HiPrinter className="w-5 h-5" /> Print
              </button>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleMarkAll(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={syncing}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="">{syncing ? 'Syncing...' : 'Mark All As...'}</option>
                <option value="Cleared">Cleared</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="all">All</option>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar - shows when items are selected */}
        {selectedCdcs.size > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-800">
                {selectedCdcs.size} cheque{selectedCdcs.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChange('Cleared')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <HiCheckCircle className="w-4 h-4" />
                Mark as Cleared
              </button>
              <button
                onClick={() => handleBulkStatusChange('Pending')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <HiClock className="w-4 h-4" />
                Mark as Pending
              </button>
              <button
                onClick={() => setSelectedCdcs(new Set())}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={filteredCdcs.length > 0 && selectedCdcs.size === filteredCdcs.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">BPV #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCdcs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      No CDCs found for this month. Create CDC vouchers in BPV Manager.
                    </td>
                  </tr>
                ) : (
                  filteredCdcs.map(cdc => (
                    <tr key={cdc.id} className={`hover:bg-slate-50 ${selectedCdcs.has(cdc.chequeNo) ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCdcs.has(cdc.chequeNo)}
                          onChange={() => toggleCdcSelection(cdc.chequeNo)}
                          className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        <Link to="/bpv" className="text-orange-600 hover:text-orange-800 hover:underline">
                          #{cdc.bpvNo || '-'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{cdc.company || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{cdc.chequeNo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(cdc.chequeDate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">{formatAED(cdc.amount)} AED</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={cdc.status}
                          onChange={(e) => handleStatusChange(cdc, e.target.value)}
                          className={`text-xs font-medium border rounded px-2 py-1 cursor-pointer ${getStatusClass(cdc.status)}`}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to="/bpv"
                          className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800"
                        >
                          <HiExternalLink className="w-4 h-4" />
                          BPV
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800">
                {FULL_MONTHS[selectedMonth]} {selectedYear}
              </h3>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-slate-500 uppercase">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((dayData, idx) => (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 border border-slate-100 rounded-lg ${
                    dayData.day ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  {dayData.day && (
                    <>
                      <div className="text-sm font-medium text-slate-700 mb-1">{dayData.day}</div>
                      <div className="space-y-1">
                        {dayData.cdcs.slice(0, 3).map(cdc => (
                          <div
                            key={cdc.id}
                            className={`text-xs p-1 rounded truncate ${
                              cdc.status === 'Cleared' ? 'bg-green-100 text-green-800' :
                              'bg-orange-100 text-orange-800'
                            }`}
                            title={`${cdc.company} - ${formatAED(cdc.amount)} AED - BPV #${cdc.bpvNo}`}
                          >
                            {cdc.company || cdc.chequeNo}
                          </div>
                        ))}
                        {dayData.cdcs.length > 3 && (
                          <div className="text-xs text-slate-400">+{dayData.cdcs.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Print Date Range Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Print CDC Report</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">From Date</label>
                  <input
                    type="date"
                    value={printFrom}
                    onChange={e => setPrintFrom(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="input-label">To Date</label>
                  <input
                    type="date"
                    value={printTo}
                    onChange={e => setPrintTo(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Status Filter</label>
                <select
                  value={printStatusFilter}
                  onChange={e => setPrintStatusFilter(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="all">All</option>
                  <option value="Pending">Pending only</option>
                  <option value="Cleared">Cleared only</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrintMonth}
                className="btn-gradient-blue px-4 py-2 text-sm font-medium rounded-lg"
              >
                <HiPrinter className="w-4 h-4 inline mr-1" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cheque Modal */}
      <AddChequeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddCheque}
        type="CDC"
      />
    </div>
  );
}

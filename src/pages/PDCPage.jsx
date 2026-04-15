import React, { useState, useEffect, useMemo } from 'react';
import { HiCreditCard, HiCalendar, HiViewList, HiClock, HiExclamation, HiCheckCircle, HiBan, HiExternalLink, HiPrinter, HiPlus, HiTrash } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import AddChequeModal from '../components/AddChequeModal';
import axios from 'axios';
import { bpvApi } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Status options with colors
const STATUS_OPTIONS = [
  { value: 'Not Released', label: 'Not Released', color: 'yellow', icon: HiClock },
  { value: 'Released', label: 'Released', color: 'green', icon: HiCheckCircle },
];

// Parse date string - handles both MM/DD/YYYY (new standard) and DD/MM/YYYY (legacy data)
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    const year = parseInt(parts[2]);

    // If first number > 12, it must be DD/MM/YYYY format (legacy data)
    // Otherwise assume MM/DD/YYYY (new standard)
    if (first > 12) {
      // DD/MM/YYYY (legacy)
      return new Date(year, second - 1, first);
    } else {
      // MM/DD/YYYY (new standard)
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

export default function PDCPage() {
  const [pdcs, setPdcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load saved preferences from localStorage or use defaults
  const [view, setView] = useState(() => {
    return localStorage.getItem('pdcView') || 'list';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('pdcStatusFilter') || 'all';
  });

  // Multi-select state
  const [selectedPdcs, setSelectedPdcs] = useState(new Set());

  // Add cheque modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Month/Year selection for filtering - load from localStorage or use current date
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem('pdcSelectedYear');
    return saved ? parseInt(saved) : new Date().getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem('pdcSelectedMonth');
    return saved !== null ? parseInt(saved) : new Date().getMonth();
  });

  // Fetch PDCs from BPV Manager and PDC Tracker sheet
  const fetchPdcs = async () => {
    try {
      setLoading(true);

      // 1. Fetch all BPV vouchers
      const bpvResponse = await bpvApi.getAll();

      // 2. Filter PDC type vouchers only
      const pdcVouchers = (bpvResponse.data || []).filter(v => v.pdcType === 'PDC');

      // 3. Extract PDCs from BPV line items
      // Group by chequeNo within each voucher and sum amounts (multiple items can share same cheque)
      const bpvPdcRecords = pdcVouchers.flatMap(voucher => {
        const itemsWithCheque = (voucher.lineItems || [])
          .filter(item => item.chequeNo && item.chequeDate);

        const chequeMap = new Map();
        itemsWithCheque.forEach((item, idx) => {
          const key = item.chequeNo;
          if (chequeMap.has(key)) {
            chequeMap.get(key).amount += parseFloat(item.debit) || 0;
          } else {
            chequeMap.set(key, {
              id: `${voucher.bpvNo}-${idx}`,
              bpvNo: voucher.bpvNo,
              bpvDate: voucher.date,
              company: item.companyName || '',
              chequeNo: item.chequeNo,
              chequeDate: item.chequeDate,
              amount: parseFloat(item.debit) || 0,
              description: item.description || '',
              status: 'Not Released', // Default, will be merged with saved status
              source: 'bpv' // Track source
            });
          }
        });

        return Array.from(chequeMap.values());
      });

      // 4. Fetch manually added PDCs from PDC Tracker sheet
      let manualPdcRecords = [];
      try {
        const manualResponse = await axios.get(`${API_BASE_URL}/pdc`);
        if (manualResponse.data.success) {
          manualPdcRecords = manualResponse.data.data
            .filter(pdc => pdc.chequeNo && pdc.chequeDate) // Must have cheque info
            .map(pdc => ({
              id: `manual-${pdc.id}`,
              rowIndex: pdc.rowIndex, // Store rowIndex for deletion
              bpvNo: pdc.bpvNo || '',
              company: pdc.company || '',
              chequeNo: pdc.chequeNo,
              chequeDate: pdc.chequeDate,
              amount: pdc.amount || 0,
              description: pdc.description || '',
              status: pdc.status || 'Not Released',
              source: 'manual' // Track source
            }));
        }
      } catch (manualErr) {
        console.warn('Could not fetch manual PDCs:', manualErr);
      }

      // 5. Merge both sources - BPV records take priority (have correct amounts)
      // Manual records come first so BPV records overwrite them in the Map
      const allPdcs = [...manualPdcRecords, ...bpvPdcRecords];
      const uniquePdcs = Array.from(
        new Map(allPdcs.map(pdc => [pdc.chequeNo, pdc])).values()
      );

      // 6. Fetch saved statuses and merge
      try {
        const statusResponse = await axios.get(`${API_BASE_URL}/pdc/statuses`);
        if (statusResponse.data.success) {
          const statusMap = statusResponse.data.data;
          uniquePdcs.forEach(pdc => {
            if (statusMap[pdc.chequeNo]) {
              pdc.status = statusMap[pdc.chequeNo];
            }
          });
        }
      } catch (statusErr) {
        console.warn('Could not fetch PDC statuses:', statusErr);
      }

      setPdcs(uniquePdcs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdcs();
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pdcView', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('pdcStatusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('pdcSelectedYear', selectedYear.toString());
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem('pdcSelectedMonth', selectedMonth.toString());
  }, [selectedMonth]);

  // Filter PDCs by selected month/year and status
  const filteredPdcs = useMemo(() => {
    const filtered = pdcs.filter(pdc => {
      const date = parseDate(pdc.chequeDate);
      if (!date) return false;

      // Filter by month/year
      const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      if (!matchesMonth) return false;

      // Filter by status
      if (statusFilter !== 'all' && pdc.status !== statusFilter) return false;

      return true;
    });

    // Sort by cheque date (oldest to newest)
    return filtered.sort((a, b) => {
      const dateA = parseDate(a.chequeDate);
      const dateB = parseDate(b.chequeDate);
      return (dateA || 0) - (dateB || 0);
    });
  }, [pdcs, selectedMonth, selectedYear, statusFilter]);

  // Get available years from PDC data
  const availableYears = useMemo(() => {
    const years = new Set();
    pdcs.forEach(pdc => {
      const date = parseDate(pdc.chequeDate);
      if (date) years.add(date.getFullYear());
    });
    // Add current year if not present
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [pdcs]);

  // Stats for selected month
  const stats = useMemo(() => {
    // Get PDCs for selected month (without status filter)
    const monthPdcs = pdcs.filter(pdc => {
      const date = parseDate(pdc.chequeDate);
      return date && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const notReleased = monthPdcs.filter(p => p.status === 'Not Released' || !p.status);
    const released = monthPdcs.filter(p => p.status === 'Released');

    const notReleasedTotal = notReleased.reduce((sum, p) => sum + (p.amount || 0), 0);
    const releasedTotal = released.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = monthPdcs.reduce((sum, p) => sum + (p.amount || 0), 0);

    return { notReleased, released, notReleasedTotal, releasedTotal, totalAmount, total: monthPdcs.length };
  }, [pdcs, selectedMonth, selectedYear]);

  // Handle status change - updates status by cheque number
  const handleStatusChange = async (pdc, newStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/pdc/status-by-cheque/${encodeURIComponent(pdc.chequeNo)}`, { status: newStatus });
      fetchPdcs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle bulk status change for selected PDCs
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedPdcs.size === 0) return;
    try {
      await axios.patch(`${API_BASE_URL}/pdc/bulk-status`, {
        chequeNumbers: Array.from(selectedPdcs),
        status: newStatus
      });
      setSelectedPdcs(new Set());
      fetchPdcs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle adding new cheque manually
  const handleAddCheque = async (chequeData) => {
    try {
      // Save to backend PDC Tracker sheet
      await axios.post(`${API_BASE_URL}/pdc`, {
        bpvNo: '',
        company: chequeData.company,
        description: '',
        chequeNo: chequeData.chequeNo,
        chequeDate: formatDateForSheet(chequeData.chequeDate),
        amount: chequeData.amount,
        status: chequeData.status,
        notes: ''
      });

      // Refresh PDCs
      fetchPdcs();
    } catch (err) {
      alert('Error adding cheque: ' + err.message);
    }
  };

  // Format date from YYYY-MM-DD to MM/DD/YYYY for Google Sheets
  const formatDateForSheet = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  // Handle deleting a PDC entry
  const handleDeletePdc = async (pdc) => {
    if (!window.confirm(`Delete cheque ${pdc.chequeNo} from ${pdc.company}?`)) {
      return;
    }

    try {
      // Only delete if it's a manual entry (has rowIndex from PDC Tracker sheet)
      if (pdc.source === 'manual' && pdc.rowIndex) {
        await axios.delete(`${API_BASE_URL}/pdc/${pdc.rowIndex}`);
        fetchPdcs();
      } else {
        alert('Cannot delete PDCs from BPV Manager. Please delete from BPV Manager directly.');
      }
    } catch (err) {
      alert('Error deleting PDC: ' + err.message);
    }
  };

  // Toggle selection for a single PDC
  const togglePdcSelection = (chequeNo) => {
    setSelectedPdcs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chequeNo)) {
        newSet.delete(chequeNo);
      } else {
        newSet.add(chequeNo);
      }
      return newSet;
    });
  };

  // Toggle select all visible PDCs
  const toggleSelectAll = () => {
    if (selectedPdcs.size === filteredPdcs.length) {
      setSelectedPdcs(new Set());
    } else {
      setSelectedPdcs(new Set(filteredPdcs.map(pdc => pdc.chequeNo)));
    }
  };

  // Get status-based class for dropdown styling
  const getStatusClass = (status) => {
    return status === 'Released'
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

  // Handle print month PDCs
  const handlePrintMonth = () => {
    // Sort PDCs by cheque date
    const sortedPdcs = [...filteredPdcs].sort((a, b) => {
      const dateA = parseDate(a.chequeDate);
      const dateB = parseDate(b.chequeDate);
      return (dateA || 0) - (dateB || 0);
    });

    const printWindow = window.open('', '_blank');

    // Generate table rows with week-colored dates
    const tableRowsHtml = sortedPdcs.map(pdc => `
      <tr>
        <td style="text-align: center;">#${pdc.bpvNo || '-'}</td>
        <td>${pdc.company || '-'}</td>
        <td style="text-align: center;">${pdc.chequeNo || '-'}</td>
        <td style="text-align: center; background-color: ${getWeekColor(pdc.chequeDate)} !important; font-weight: 500;">${formatDate(pdc.chequeDate)}</td>
        <td style="text-align: right;">${formatAED(pdc.amount)} AED</td>
        <td style="text-align: center;">${pdc.status || 'Not Released'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PDC Report - ${FULL_MONTHS[selectedMonth]} ${selectedYear}</title>
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
          th { background: #1e293b; color: white; padding: 10px 8px; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px; border: 1px solid #ddd; font-size: 11px; }
          tr:nth-child(even) { background: #fafafa; }
          .total-row { background: #fef3c7 !important; font-weight: bold; }
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
          <h2>PDC TRACKER REPORT</h2>
          <p>${FULL_MONTHS[selectedMonth]} ${selectedYear} - ${stats.total} PDCs (${formatAED(stats.totalAmount)} AED)</p>
        </div>

        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Not Released</div>
            <div class="stat-value">${stats.notReleased.length} PDCs - ${formatAED(stats.notReleasedTotal)} AED</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Released</div>
            <div class="stat-value">${stats.released.length} PDCs - ${formatAED(stats.releasedTotal)} AED</div>
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
              <td style="text-align: right;">${formatAED(stats.totalAmount)} AED</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          Generated on ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate calendar days for selected month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const days = [];

    // Padding for previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, pdcs: [] });
    }

    // Days of current month - use PDCs without status filter for calendar
    const monthPdcs = pdcs.filter(pdc => {
      const date = parseDate(pdc.chequeDate);
      return date && date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dayPdcs = monthPdcs.filter(pdc => {
        const date = parseDate(pdc.chequeDate);
        return date && date.getDate() === d;
      });
      days.push({ day: d, pdcs: dayPdcs });
    }

    return days;
  }, [selectedYear, selectedMonth, pdcs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <PageHeader
        title="PDC Tracker"
        subtitle="Post-Dated Cheques from BPV Manager"
        icon={HiCreditCard}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              to="/cdc"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiCreditCard className="w-4 h-4" />
              CDC Tracker
            </Link>
            <Link
              to="/bpv"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <HiExternalLink className="w-4 h-4" />
              Manage PDCs in BPV Manager
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
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-lg font-semibold text-slate-800">
              {FULL_MONTHS[selectedMonth]} {selectedYear} - Total: {stats.total} PDCs ({formatAED(stats.totalAmount)} AED)
            </p>
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
                <p className="text-sm text-slate-500">Not Released</p>
                <p className="text-xl font-bold text-slate-800">{stats.notReleased.length}</p>
                <p className="text-xs text-slate-400">{formatAED(stats.notReleasedTotal)} AED</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <HiCheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Released</p>
                <p className="text-xl font-bold text-slate-800">{stats.released.length}</p>
                <p className="text-xs text-slate-400">{formatAED(stats.releasedTotal)} AED</p>
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
                  view === 'list' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiViewList className="w-5 h-5" /> List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  view === 'calendar' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiCalendar className="w-5 h-5" /> Calendar
              </button>
              <button
                onClick={handlePrintMonth}
                disabled={filteredPdcs.length === 0}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <HiPrinter className="w-5 h-5" /> Print
              </button>
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
        {selectedPdcs.size > 0 && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-cyan-800">
                {selectedPdcs.size} cheque{selectedPdcs.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChange('Released')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <HiCheckCircle className="w-4 h-4" />
                Mark as Released
              </button>
              <button
                onClick={() => handleBulkStatusChange('Not Released')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <HiClock className="w-4 h-4" />
                Mark as Not Released
              </button>
              <button
                onClick={() => setSelectedPdcs(new Set())}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (() => {
          const notReleasedPdcs = filteredPdcs.filter(p => p.status !== 'Released');
          const releasedPdcs = filteredPdcs.filter(p => p.status === 'Released');

          const renderRow = (pdc) => (
            <tr key={pdc.id} className={`hover:bg-slate-50 ${selectedPdcs.has(pdc.chequeNo) ? 'bg-cyan-50' : ''}`}>
              <td className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedPdcs.has(pdc.chequeNo)}
                  onChange={() => togglePdcSelection(pdc.chequeNo)}
                  className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                />
              </td>
              <td className="px-4 py-3 text-sm font-medium text-slate-800">
                <Link to="/bpv" className="text-blue-600 hover:text-blue-800 hover:underline">
                  #{pdc.bpvNo || '-'}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{pdc.company || '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{pdc.chequeNo || '-'}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{formatDate(pdc.chequeDate)}</td>
              <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">{formatAED(pdc.amount)} AED</td>
              <td className="px-4 py-3 text-center">
                <select
                  value={pdc.status}
                  onChange={(e) => handleStatusChange(pdc, e.target.value)}
                  className={`text-xs font-medium border rounded px-2 py-1 cursor-pointer ${getStatusClass(pdc.status)}`}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-center">
                <Link to="/bpv" className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800">
                  <HiExternalLink className="w-4 h-4" />
                  BPV
                </Link>
              </td>
              <td className="px-4 py-3 text-center">
                {pdc.source === 'manual' ? (
                  <button
                    onClick={() => handleDeletePdc(pdc)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                    title="Delete PDC"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </td>
            </tr>
          );

          const colSpan = 9;

          return (
            <div className="space-y-4">
              {/* Not Released Section */}
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiClock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Not Released</span>
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{notReleasedPdcs.length}</span>
                  </div>
                  <span className="text-sm font-medium text-amber-700">
                    {formatAED(notReleasedPdcs.reduce((s, p) => s + (p.amount || 0), 0))} AED
                  </span>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center">
                        <input type="checkbox"
                          checked={notReleasedPdcs.length > 0 && notReleasedPdcs.every(p => selectedPdcs.has(p.chequeNo))}
                          onChange={() => {
                            const allSelected = notReleasedPdcs.every(p => selectedPdcs.has(p.chequeNo));
                            setSelectedPdcs(prev => {
                              const next = new Set(prev);
                              notReleasedPdcs.forEach(p => allSelected ? next.delete(p.chequeNo) : next.add(p.chequeNo));
                              return next;
                            });
                          }}
                          className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">BPV #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">View</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {notReleasedPdcs.length === 0 ? (
                      <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400 text-sm">No unreleased PDCs this month</td></tr>
                    ) : notReleasedPdcs.map(renderRow)}
                  </tbody>
                </table>
              </div>

              {/* Released Section */}
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiCheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-800">Released</span>
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">{releasedPdcs.length}</span>
                  </div>
                  <span className="text-sm font-medium text-green-700">
                    {formatAED(releasedPdcs.reduce((s, p) => s + (p.amount || 0), 0))} AED
                  </span>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center">
                        <input type="checkbox"
                          checked={releasedPdcs.length > 0 && releasedPdcs.every(p => selectedPdcs.has(p.chequeNo))}
                          onChange={() => {
                            const allSelected = releasedPdcs.every(p => selectedPdcs.has(p.chequeNo));
                            setSelectedPdcs(prev => {
                              const next = new Set(prev);
                              releasedPdcs.forEach(p => allSelected ? next.delete(p.chequeNo) : next.add(p.chequeNo));
                              return next;
                            });
                          }}
                          className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">BPV #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">View</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {releasedPdcs.length === 0 ? (
                      <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400 text-sm">No released PDCs this month</td></tr>
                    ) : releasedPdcs.map(renderRow)}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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
                        {dayData.pdcs.slice(0, 3).map(pdc => (
                          <div
                            key={pdc.id}
                            className={`text-xs p-1 rounded truncate ${
                              pdc.status === 'Released' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}
                            title={`${pdc.company} - ${formatAED(pdc.amount)} AED - BPV #${pdc.bpvNo}`}
                          >
                            {pdc.company || pdc.chequeNo}
                          </div>
                        ))}
                        {dayData.pdcs.length > 3 && (
                          <div className="text-xs text-slate-400">+{dayData.pdcs.length - 3} more</div>
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

      {/* Add Cheque Modal */}
      <AddChequeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddCheque}
        type="PDC"
      />
    </div>
  );
}

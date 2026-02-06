import React, { useState, useEffect, useMemo } from 'react';
import { HiCreditCard, HiCalendar, HiViewList, HiPlus, HiPencil, HiTrash, HiCheck, HiX, HiClock, HiExclamation, HiCheckCircle, HiBan } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SlideOutPanel from '../components/SlideOutPanel';
import axios from 'axios';

const API_BASE_URL = 'https://bpv-backend-production.up.railway.app/api';

// Status options with colors
const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending', color: 'yellow', icon: HiClock },
  { value: 'Cleared', label: 'Cleared', color: 'green', icon: HiCheckCircle },
  { value: 'Bounced', label: 'Bounced', color: 'red', icon: HiExclamation },
  { value: 'Cancelled', label: 'Cancelled', color: 'gray', icon: HiBan },
];

// Parse date string (DD/MM/YYYY) to Date object
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
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


// Month names for tabs
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PDCPage() {
  const [pdcs, setPdcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPdc, setSelectedPdc] = useState(null);

  // Month/Year selection for filtering
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11

  // Fetch PDCs
  const fetchPdcs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/pdc`);
      if (response.data.success) {
        setPdcs(response.data.data);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdcs();
  }, []);

  // Filter PDCs by selected month/year and status
  const filteredPdcs = useMemo(() => {
    return pdcs.filter(pdc => {
      const date = parseDate(pdc.chequeDate);
      if (!date) return false;

      // Filter by month/year
      const matchesMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      if (!matchesMonth) return false;

      // Filter by status
      if (statusFilter !== 'all' && pdc.status !== statusFilter) return false;

      return true;
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

    const pending = monthPdcs.filter(p => p.status === 'Pending');
    const cleared = monthPdcs.filter(p => p.status === 'Cleared');
    const bounced = monthPdcs.filter(p => p.status === 'Bounced');

    const pendingTotal = pending.reduce((sum, p) => sum + (p.amount || 0), 0);
    const clearedTotal = cleared.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAmount = monthPdcs.reduce((sum, p) => sum + (p.amount || 0), 0);

    return { pending, cleared, bounced, pendingTotal, clearedTotal, totalAmount, total: monthPdcs.length };
  }, [pdcs, selectedMonth, selectedYear]);

  // Handle status change
  const handleStatusChange = async (pdc, newStatus) => {
    try {
      await axios.patch(`${API_BASE_URL}/pdc/${pdc.rowIndex}/status`, { status: newStatus });
      fetchPdcs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle delete
  const handleDelete = async (pdc) => {
    if (!window.confirm(`Delete PDC for cheque ${pdc.chequeNo}?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/pdc/${pdc.rowIndex}`);
      fetchPdcs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle save (create/update)
  const handleSave = async (formData) => {
    try {
      if (selectedPdc) {
        await axios.put(`${API_BASE_URL}/pdc/${selectedPdc.rowIndex}`, formData);
      } else {
        await axios.post(`${API_BASE_URL}/pdc`, formData);
      }
      setIsPanelOpen(false);
      setSelectedPdc(null);
      fetchPdcs();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
        subtitle="Post-Dated Cheques Management"
        icon={HiCreditCard}
        onAction={() => { setSelectedPdc(null); setIsPanelOpen(true); }}
        actionLabel="Add PDC"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back to Dashboard */}
        <Link to="/" className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <HiExclamation className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Bounced</p>
                <p className="text-xl font-bold text-slate-800">{stats.bounced.length}</p>
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

        {/* List View */}
        {view === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">BPV #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cheque Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPdcs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No PDCs found
                    </td>
                  </tr>
                ) : (
                  filteredPdcs.map(pdc => (
                    <tr key={pdc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{pdc.bpvNo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{pdc.company || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{pdc.chequeNo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(pdc.chequeDate)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">{formatAED(pdc.amount)} AED</td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={pdc.status}
                          onChange={(e) => handleStatusChange(pdc, e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1"
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedPdc(pdc); setIsPanelOpen(true); }}
                            className="p-1 text-slate-400 hover:text-cyan-600"
                          >
                            <HiPencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(pdc)}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </div>
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
                        {dayData.pdcs.slice(0, 3).map(pdc => (
                          <div
                            key={pdc.id}
                            className={`text-xs p-1 rounded truncate cursor-pointer ${
                              pdc.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              pdc.status === 'Cleared' ? 'bg-green-100 text-green-800' :
                              pdc.status === 'Bounced' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                            onClick={() => { setSelectedPdc(pdc); setIsPanelOpen(true); }}
                            title={`${pdc.company} - ${formatAED(pdc.amount)} AED`}
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

      {/* PDC Form Panel */}
      <SlideOutPanel
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); setSelectedPdc(null); }}
        title={selectedPdc ? 'Edit PDC' : 'Add PDC'}
      >
        <PDCForm
          pdc={selectedPdc}
          onSave={handleSave}
          onClose={() => { setIsPanelOpen(false); setSelectedPdc(null); }}
        />
      </SlideOutPanel>
    </div>
  );
}

// PDC Form Component
function PDCForm({ pdc, onSave, onClose }) {
  const [formData, setFormData] = useState({
    bpvNo: pdc?.bpvNo || '',
    company: pdc?.company || '',
    description: pdc?.description || '',
    chequeNo: pdc?.chequeNo || '',
    chequeDate: pdc?.chequeDate || '',
    amount: pdc?.amount || '',
    status: pdc?.status || 'Pending',
    notes: pdc?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await onSave(formData);
    if (!result.success) {
      setError(result.error);
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">BPV No</label>
          <input
            type="text"
            value={formData.bpvNo}
            onChange={(e) => setFormData({ ...formData, bpvNo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            placeholder="e.g., 123"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cheque No *</label>
          <input
            type="text"
            required
            value={formData.chequeNo}
            onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            placeholder="e.g., CHQ-001"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Company *</label>
        <input
          type="text"
          required
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          placeholder="Company name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          placeholder="Description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cheque Date *</label>
          <input
            type="text"
            required
            value={formData.chequeDate}
            onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            placeholder="DD/MM/YYYY"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (AED) *</label>
          <input
            type="number"
            required
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          rows="3"
          placeholder="Additional notes..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save PDC'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

import React, { useState, useMemo } from 'react';
import { HiDocumentText, HiSearch, HiSortDescending, HiCalendar } from 'react-icons/hi';
import TableView from './TableView';
import CardView from './CardView';
import ViewToggle from './ViewToggle';

// Parse date string (DD/MM/YYYY) to Date object
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

// Format number as AED currency
const formatAED = (amount) => {
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export default function VoucherList({
  vouchers,
  loading,
  error,
  view,
  onViewChange,
  typeFilter,
  onTypeFilterChange,
  onEdit,
  onDelete
}) {
  // Search, sort, and date filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all'); // all, company, cheque, bpv, description
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, amount-desc, amount-asc, bpv-desc, bpv-asc
  const [dateFilter, setDateFilter] = useState('all'); // all, this-month, last-month, this-year

  // Search helper - checks if voucher matches search query (case-insensitive substring match)
  // Also matches when spaces are ignored (e.g., "alphatech" matches "ALPHA TECH")
  const matchesSearch = (voucher, query, field) => {
    const q = query.toLowerCase();
    const qNoSpaces = q.replace(/\s+/g, '');

    const textMatches = (text) => {
      if (!text) return false;
      const t = text.toString().toLowerCase();
      return t.includes(q) || t.replace(/\s+/g, '').includes(qNoSpaces);
    };

    // Search specific field only
    if (field === 'bpv') {
      return textMatches(voucher.bpvNo);
    }

    if (field === 'cheque') {
      if (voucher.lineItems && Array.isArray(voucher.lineItems)) {
        for (const item of voucher.lineItems) {
          if (textMatches(item.chequeNo)) return true;
        }
      }
      return false;
    }

    if (field === 'company') {
      if (voucher.lineItems && Array.isArray(voucher.lineItems)) {
        for (const item of voucher.lineItems) {
          if (textMatches(item.companyName)) return true;
        }
      }
      return false;
    }

    if (field === 'description') {
      if (voucher.lineItems && Array.isArray(voucher.lineItems)) {
        for (const item of voucher.lineItems) {
          if (textMatches(item.description)) return true;
        }
      }
      return false;
    }

    // Search all fields (default)
    if (textMatches(voucher.bpvNo)) return true;

    if (voucher.lineItems && Array.isArray(voucher.lineItems)) {
      for (const item of voucher.lineItems) {
        if (textMatches(item.companyName)) return true;
        if (textMatches(item.description)) return true;
        if (textMatches(item.chequeNo)) return true;
      }
    }

    return false;
  };

  // Apply all filters and sorting
  const processedVouchers = useMemo(() => {
    let result = vouchers;

    // 1. Apply type filter (PDC/CDC)
    if (typeFilter !== 'all') {
      result = result.filter(v => v.pdcType === typeFilter);
    }

    // 2. Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      result = result.filter(v => {
        const voucherDate = parseDate(v.date);
        if (!voucherDate) return false;

        switch (dateFilter) {
          case 'this-month':
            return voucherDate.getMonth() === currentMonth && voucherDate.getFullYear() === currentYear;
          case 'last-month':
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return voucherDate.getMonth() === lastMonth && voucherDate.getFullYear() === lastMonthYear;
          case 'this-year':
            return voucherDate.getFullYear() === currentYear;
          default:
            return true;
        }
      });
    }

    // 3. Apply search (exact substring match)
    if (searchQuery.trim()) {
      result = result.filter(v => matchesSearch(v, searchQuery.trim(), searchField));
    }

    // 4. Apply sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (parseDate(b.date) || 0) - (parseDate(a.date) || 0);
        case 'date-asc':
          return (parseDate(a.date) || 0) - (parseDate(b.date) || 0);
        case 'amount-desc':
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case 'amount-asc':
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case 'bpv-desc':
          return parseInt(b.bpvNo || 0) - parseInt(a.bpvNo || 0);
        case 'bpv-asc':
          return parseInt(a.bpvNo || 0) - parseInt(b.bpvNo || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [vouchers, typeFilter, dateFilter, searchQuery, searchField, sortBy]);

  // Calculate totals for filtered vouchers
  const totals = useMemo(() => {
    const total = processedVouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    return {
      count: processedVouchers.length,
      amount: total,
    };
  }, [processedVouchers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading vouchers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading vouchers</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (vouchers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiDocumentText className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No vouchers yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first BPV to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar with Field Selector */}
      <div className="flex gap-2">
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value)}
          className="px-3 py-3 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
        >
          <option value="all">All Fields</option>
          <option value="company">Company</option>
          <option value="cheque">Cheque #</option>
          <option value="bpv">BPV #</option>
          <option value="description">Description</option>
        </select>
        <div className="relative flex-1">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={
              searchField === 'all' ? "Search by company, description, cheque number, or BPV..." :
              searchField === 'company' ? "Search by company name..." :
              searchField === 'cheque' ? "Search by cheque number..." :
              searchField === 'bpv' ? "Search by BPV number..." :
              "Search by description..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 placeholder-slate-400"
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
      </div>

      {/* Filters Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <button
              onClick={() => onTypeFilterChange('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onTypeFilterChange('PDC')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'PDC'
                  ? 'bg-blue-500 text-white'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              PDC
            </button>
            <button
              onClick={() => onTypeFilterChange('CDC')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                typeFilter === 'CDC'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-600 hover:bg-orange-50'
              }`}
            >
              CDC
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <HiCalendar className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-year">This Year</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <HiSortDescending className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 text-sm font-medium text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="date-desc">Date (Newest)</option>
              <option value="date-asc">Date (Oldest)</option>
              <option value="amount-desc">Amount (High → Low)</option>
              <option value="amount-asc">Amount (Low → High)</option>
              <option value="bpv-desc">BPV # (High → Low)</option>
              <option value="bpv-asc">BPV # (Low → High)</option>
            </select>
          </div>
        </div>

        <ViewToggle view={view} onViewChange={onViewChange} />
      </div>

      {/* Totals Bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl px-4 py-3 border border-blue-100">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Vouchers</p>
            <p className="text-lg font-bold text-slate-800">{totals.count}</p>
          </div>
          <div className="h-8 w-px bg-blue-200" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Amount</p>
            <p className="text-lg font-bold text-blue-600">{formatAED(totals.amount)} AED</p>
          </div>
        </div>
        {processedVouchers.length !== vouchers.length && (
          <p className="text-sm text-slate-500">
            Showing {processedVouchers.length} of {vouchers.length}
          </p>
        )}
      </div>

      {/* No Results */}
      {processedVouchers.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <HiSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No vouchers found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFilter('all');
                onTypeFilterChange('all');
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}

      {/* View */}
      {processedVouchers.length > 0 && (
        view === 'table' ? (
          <TableView vouchers={processedVouchers} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <CardView vouchers={processedVouchers} onEdit={onEdit} onDelete={onDelete} />
        )
      )}
    </div>
  );
}
